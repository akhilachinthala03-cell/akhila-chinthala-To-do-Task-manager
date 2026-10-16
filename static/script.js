const form = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const message = document.getElementById("message");

const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const deadlineInput = document.getElementById("deadline");
const priorityInput = document.getElementById("priority");
const categoryInput = document.getElementById("category");

const searchInput = document.getElementById("search");
const dateFilter = document.getElementById("date-filter");
const statusFilter = document.getElementById("status-filter");

const createButton = document.getElementById("create-task-btn");
const cancelButton = document.getElementById("cancel-form");
const cancelButton2 = document.getElementById("cancel-form-2");
const clearButton = document.getElementById("clear-filters");

let currentCategory = "Assigned";
let editingTaskId = null;
let allTasks = [];

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Something went wrong");
    }

    return result;
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#059669";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function openForm(task = null) {
    editingTaskId = task ? task.id : null;

    document.getElementById("form-heading").textContent =
        task ? "Edit Task" : "Create New Task";

    document.getElementById("save-task-btn").textContent =
        task ? "Update Task" : "Save Task";

    titleInput.value = task ? task.title : "";
    descriptionInput.value = task ? task.description : "";
    deadlineInput.value = task ? task.deadline : "";
    priorityInput.value = task ? task.priority : "Medium";
    categoryInput.value = task ? task.category : currentCategory;

    form.hidden = false;
    titleInput.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeForm() {
    form.hidden = true;
    form.reset();
    editingTaskId = null;
}

function renderCounts(tasks) {
    document.getElementById("assigned-count").textContent =
        tasks.filter(t => t.category === "Assigned").length;
    document.getElementById("accepted-count").textContent =
        tasks.filter(t => t.category === "Accepted").length;
    document.getElementById("review-count").textContent =
        tasks.filter(t => t.category === "Review").length;
}

function renderTasks(tasks) {
    const term = searchInput.value.trim().toLowerCase();

    const filtered = tasks.filter(task => {
        const text = `${task.title} ${task.description} ${task.created_by}`
            .toLowerCase();

        return text.includes(term);
    });

    if (filtered.length === 0) {
        taskList.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No tasks found. Click "Create New Task" to add one.
                </td>
            </tr>`;
        return;
    }

    taskList.innerHTML = filtered.map(task => {
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        const statusClass = task.status === "Completed"
            ? "status-completed"
            : "status-pending";

        return `
            <tr>
                <td>
                    <div class="task-title">${escapeHTML(task.title)}</div>
                    ${task.description
                        ? `<div class="description-text">${escapeHTML(task.description)}</div>`
                        : ""}
                </td>
                <td>
                    <span class="badge ${priorityClass}">
                        ${escapeHTML(task.priority)}
                    </span>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${escapeHTML(task.status)}
                    </span>
                </td>
                <td>${escapeHTML(task.created_by || "Admin")}</td>
                <td>${escapeHTML(task.deadline || "Not set")}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" data-action="view"
                            data-id="${task.id}" title="View">View</button>
                        <button class="action-btn" data-action="edit"
                            data-id="${task.id}" title="Edit">Edit</button>
                        <button class="action-btn" data-action="toggle"
                            data-id="${task.id}">
                            ${task.status === "Completed" ? "Reopen" : "Complete"}
                        </button>
                        <button class="action-btn delete" data-action="delete"
                            data-id="${task.id}" title="Delete">Delete</button>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

async function loadTasks() {
    taskList.innerHTML =
        '<tr><td colspan="6" class="empty-state">Loading tasks...</td></tr>';

    try {
        const params = new URLSearchParams({
            category: currentCategory
        });

        if (statusFilter.value) {
            params.set("status", statusFilter.value);
        }

        if (dateFilter.value) {
            params.set("deadline", dateFilter.value);
        }

        allTasks = await api(`/api/tasks?${params.toString()}`);

        renderTasks(allTasks);

        // Load all categories separately to calculate tab counts.
        const allCategories = await api("/api/tasks");
        renderCounts(allCategories);
        showMessage("");
    } catch (error) {
        taskList.innerHTML = `
            <tr><td colspan="6" class="empty-state">
                Could not load tasks. Check whether the Flask server is running.
            </td></tr>`;
        showMessage(error.message, true);
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        deadline: deadlineInput.value,
        priority: priorityInput.value,
        category: categoryInput.value
    };

    try {
        if (editingTaskId !== null) {
            await api(`/api/tasks/${editingTaskId}`, {
                method: "PATCH",
                body: JSON.stringify(data)
            });
            showMessage("Task updated successfully.");
        } else {
            await api("/api/tasks", {
                method: "POST",
                body: JSON.stringify(data)
            });
            showMessage("Task created successfully.");
        }

        currentCategory = data.category;
        document.querySelectorAll(".tab").forEach(tab => {
            tab.classList.toggle(
                "active",
                tab.dataset.category === currentCategory
            );
        });

        document.getElementById("current-category").textContent =
            `${currentCategory} Tasks`;

        closeForm();
        await loadTasks();
    } catch (error) {
        showMessage(error.message, true);
    }
});

createButton.addEventListener("click", () => openForm());
cancelButton.addEventListener("click", closeForm);
cancelButton2.addEventListener("click", closeForm);

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        currentCategory = tab.dataset.category;

        document.querySelectorAll(".tab").forEach(item => {
            item.classList.toggle("active", item === tab);
        });

        document.getElementById("current-category").textContent =
            `${currentCategory} Tasks`;

        showMessage("");
        loadTasks();
    });
});

searchInput.addEventListener("input", () => renderTasks(allTasks));
statusFilter.addEventListener("change", loadTasks);
dateFilter.addEventListener("change", loadTasks);

clearButton.addEventListener("click", () => {
    searchInput.value = "";
    dateFilter.value = "";
    statusFilter.value = "";
    loadTasks();
});

taskList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const task = allTasks.find(item => item.id === id);

    if (!task) return;

    if (action === "view") {
        alert(
            `Title: ${task.title}\n\n` +
            `Description: ${task.description || "None"}\n` +
            `Category: ${task.category}\n` +
            `Priority: ${task.priority}\n` +
            `Status: ${task.status}\n` +
            `Created By: ${task.created_by || "Admin"}\n` +
            `Due Date: ${task.deadline || "Not set"}`
        );
        return;
    }

    if (action === "edit") {
        openForm(task);
        return;
    }

    if (action === "delete") {
        if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            await api(`/api/tasks/${id}`, { method: "DELETE" });
            showMessage("Task deleted successfully.");
            await loadTasks();
        } catch (error) {
            showMessage(error.message, true);
        }
        return;
    }

    if (action === "toggle") {
        const newStatus = task.status === "Completed"
            ? "Pending"
            : "Completed";

        try {
            await api(`/api/tasks/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
            showMessage(`Task marked ${newStatus}.`);
            await loadTasks();
        } catch (error) {
            showMessage(error.message, true);
        }
    }
});

loadTasks();
