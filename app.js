/* ====================================
   KANBAN BOARD - STATE-FIRST ARCHITECTURE
   State drives UI, never read from DOM
   ==================================== */

// ====================================
// STATE MANAGEMENT
// ====================================

let tasks = [];
let draggedTaskId = null;
let taskToDelete = null;
let editingTaskId = null;
let currentTheme = 'default';

const STORAGE_KEY = 'kanban_tasks';
const THEME_STORAGE_KEY = 'kanban_theme';

const COLUMNS = [
    { id: 'todo', title: 'To Do' },
    { id: 'inprogress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
];

const THEMES = {
    default: 'Ocean Blue (Default)',
    sunset: 'Sunset Orange',
    forest: 'Forest Green',
    midnight: 'Midnight Purple',
    rose: 'Rose Pink'
};

// ====================================
// DATA PERSISTENCE
// ====================================

function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            tasks = JSON.parse(stored);
            console.log(`✅ Loaded ${tasks.length} tasks from localStorage`);
        }
    } catch (error) {
        console.error('❌ Error loading tasks:', error);
        tasks = [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        console.log(`💾 Saved ${tasks.length} tasks to localStorage`);
    } catch (error) {
        console.error('❌ Error saving tasks:', error);
    }
}

function loadTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved && THEMES[saved]) {
            currentTheme = saved;
            applyTheme(currentTheme);
            console.log(`🎨 Loaded theme: ${THEMES[currentTheme]}`);
        }
    } catch (error) {
        console.error('❌ Error loading theme:', error);
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        console.log(`🎨 Saved theme: ${THEMES[theme]}`);
    } catch (error) {
        console.error('❌ Error saving theme:', error);
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
    currentTheme = theme;

    // Update dropdown
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = theme;
    }
}

// ====================================
// TASK CRUD OPERATIONS
// ====================================

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function addTask(title, description = '') {
    const task = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        status: 'todo',
        createdAt: Date.now()
    };

    tasks.push(task);
    saveTasks();
    console.log('➕ Task added:', task.title);
    return task;
}

function updateTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const oldStatus = task.status;
        task.status = newStatus;
        saveTasks();
        console.log(`🔄 Task moved: ${oldStatus} → ${newStatus}`);
        return task;
    }
    return null;
}

function updateTask(taskId, updates) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        Object.assign(task, updates);
        saveTasks();
        console.log('✏️ Task updated:', task.title);
        return task;
    }
    return null;
}

function deleteTask(taskId) {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        const deleted = tasks.splice(index, 1)[0];
        saveTasks();
        console.log('🗑️ Task deleted:', deleted.title);
        return deleted;
    }
    return null;
}

function getTasksByStatus(status) {
    return tasks.filter(t => t.status === status);
}

// ====================================
// RENDERING FUNCTIONS
// ====================================

function renderBoard() {
    COLUMNS.forEach(column => {
        const container = document.getElementById(`${column.id}Container`);
        const columnTasks = getTasksByStatus(column.id);

        // Clear container
        container.innerHTML = '';

        // Render tasks or empty state
        if (columnTasks.length === 0) {
            container.appendChild(createEmptyState(column.id));
        } else {
            columnTasks.forEach(task => {
                container.appendChild(createTaskCard(task));
            });
        }

        // Update task count
        updateTaskCount(column.id, columnTasks.length);
    });
}

function createEmptyState(status) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const messages = {
        todo: {
            icon: '✨',
            text: 'No tasks yet',
            hint: 'Add a task above to get started'
        },
        inprogress: {
            icon: '🚀',
            text: 'Nothing in progress',
            hint: 'Drag tasks here to start working'
        },
        done: {
            icon: '🎉',
            text: 'No completed tasks',
            hint: 'Move finished tasks here'
        }
    };

    const msg = messages[status];

    emptyState.innerHTML = `
        <span class="empty-icon">${msg.icon}</span>
        <p class="empty-text">${msg.text}</p>
        <p class="empty-hint">${msg.hint}</p>
    `;

    return emptyState;
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    const createdDate = new Date(task.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    card.innerHTML = `
        <div class="task-card-header">
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <div class="task-actions">
                <button class="task-action-btn edit-btn" data-action="edit" title="Edit">✏️</button>
                <button class="task-action-btn delete-btn" data-action="delete" title="Delete">🗑️</button>
            </div>
        </div>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">Created: ${createdDate}</div>
    `;

    // Add event listeners
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    // Action button listeners
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startEditTask(task.id);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteModal(task.id);
    });

    return card;
}

function updateTaskCount(status, count) {
    const countElement = document.querySelector(`[data-column="${status}"]`);
    if (countElement) {
        countElement.textContent = count;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ====================================
// DRAG & DROP SYSTEM
// ====================================

function handleDragStart(e) {
    draggedTaskId = e.target.dataset.taskId;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    console.log('🖱️ Drag started:', draggedTaskId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    removeAllHighlights();
    console.log('🖱️ Drag ended');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = e.currentTarget;
    if (!container.classList.contains('drag-over')) {
        container.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const container = e.currentTarget;

    // Only remove highlight if we're leaving the container entirely
    if (!container.contains(e.relatedTarget)) {
        container.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const container = e.currentTarget;
    const newStatus = container.dataset.status;

    if (draggedTaskId && newStatus) {
        updateTaskStatus(draggedTaskId, newStatus);
        renderBoard();
        console.log(`✅ Task dropped in ${newStatus}`);
    }

    removeAllHighlights();
    draggedTaskId = null;
}

function removeAllHighlights() {
    document.querySelectorAll('.tasks-container').forEach(container => {
        container.classList.remove('drag-over');
    });
}

// ====================================
// TASK EDITING
// ====================================

function startEditTask(taskId) {
    editingTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!card) return;

    card.classList.add('editing');
    card.draggable = false;

    const titleElement = card.querySelector('.task-title');
    const descElement = card.querySelector('.task-description');

    const currentTitle = task.title;
    const currentDesc = task.description || '';

    titleElement.innerHTML = `
        <input 
            type="text" 
            class="task-edit-input" 
            value="${escapeHtml(currentTitle)}"
            maxlength="100"
            id="editInput-${taskId}"
        >
    `;

    if (descElement) {
        descElement.innerHTML = `
            <textarea 
                class="task-input task-edit-input" 
                style="margin-top: 0.5rem;"
                maxlength="500"
                rows="2"
                id="editDesc-${taskId}"
            >${escapeHtml(currentDesc)}</textarea>
        `;
    }

    const actionsDiv = card.querySelector('.task-actions');
    actionsDiv.style.opacity = '1';
    actionsDiv.innerHTML = `
        <button class="task-action-btn" data-action="save-edit" title="Save">💾</button>
        <button class="task-action-btn" data-action="cancel-edit" title="Cancel">❌</button>
    `;

    actionsDiv.querySelector('[data-action="save-edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        saveEdit(taskId);
    });

    actionsDiv.querySelector('[data-action="cancel-edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        cancelEdit();
    });

    // Focus the input
    const input = document.getElementById(`editInput-${taskId}`);
    input.focus();
    input.select();

    // Handle Enter key to save
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit(taskId);
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
}

function saveEdit(taskId) {
    const input = document.getElementById(`editInput-${taskId}`);
    const descInput = document.getElementById(`editDesc-${taskId}`);

    if (!input) return;

    const newTitle = input.value.trim();

    if (newTitle === '') {
        alert('Task title cannot be empty');
        input.focus();
        return;
    }

    const updates = {
        title: newTitle
    };

    if (descInput) {
        updates.description = descInput.value.trim();
    }

    updateTask(taskId, updates);
    editingTaskId = null;
    renderBoard();
}

function cancelEdit() {
    editingTaskId = null;
    renderBoard();
}

// ====================================
// DELETE CONFIRMATION MODAL
// ====================================

function showDeleteModal(taskId) {
    taskToDelete = taskId;
    const modal = document.getElementById('deleteModal');
    modal.classList.add('active');
}

function hideDeleteModal() {
    taskToDelete = null;
    const modal = document.getElementById('deleteModal');
    modal.classList.remove('active');
}

function confirmDelete() {
    if (taskToDelete) {
        deleteTask(taskToDelete);
        renderBoard();
        hideDeleteModal();
    }
}

// ====================================
// FORM HANDLING
// ====================================

function handleTaskFormSubmit(e) {
    e.preventDefault();

    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (title === '') {
        titleInput.focus();
        return;
    }

    addTask(title, description);
    renderBoard();

    // Clear form
    titleInput.value = '';
    descInput.value = '';
    titleInput.focus();
}

// ====================================
// EVENT LISTENERS SETUP
// ====================================

function setupEventListeners() {
    // Task form
    const taskForm = document.getElementById('taskForm');
    taskForm.addEventListener('submit', handleTaskFormSubmit);

    // Theme selector
    const themeSelect = document.getElementById('themeSelect');
    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        applyTheme(selectedTheme);
        saveTheme(selectedTheme);
        console.log(`🎨 Theme changed to: ${THEMES[selectedTheme]}`);
    });

    // Drag & drop on all containers
    COLUMNS.forEach(column => {
        const container = document.getElementById(`${column.id}Container`);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
    });

    // Delete modal
    document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);

    // Close modal on backdrop click
    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') {
            hideDeleteModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modal
        if (e.key === 'Escape') {
            hideDeleteModal();
            if (editingTaskId) {
                cancelEdit();
            }
        }
    });
}

// ====================================
// INITIALIZATION
// ====================================

function init() {
    console.log('🚀 Initializing Kanban Board...');
    loadTheme();
    loadTasks();
    setupEventListeners();
    renderBoard();
    console.log('✅ Kanban Board ready!');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
