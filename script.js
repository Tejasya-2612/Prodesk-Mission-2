// ============================================================
// Cash-Flow Tracker — Vanilla JavaScript
// ============================================================

// --- LocalStorage keys ---
const SALARY_KEY   = "cashflow_salary";
const EXPENSES_KEY = "cashflow_expenses";

// --- State ---
let salary   = 0;
let expenses = [];  // [{ id, name, amount }]

// --- Chart instance (kept so we can destroy before re-drawing) ---
let chartInstance = null;

// ============================================================
// DOM References
// ============================================================
const salaryInput      = document.getElementById("salary-input");
const btnSetSalary     = document.getElementById("btn-set-salary");
const expenseNameInput = document.getElementById("expense-name");
const expenseAmtInput  = document.getElementById("expense-amount");
const btnAddExpense    = document.getElementById("btn-add-expense");

const displaySalary    = document.getElementById("display-salary");
const displayTotal     = document.getElementById("display-total-expenses");
const displayBalance   = document.getElementById("display-balance");
const balanceCard      = document.getElementById("balance-card");

const expenseList      = document.getElementById("expense-list");
const emptyState       = document.getElementById("empty-state");
const expenseFooter    = document.getElementById("expense-footer");
const footerTotal      = document.getElementById("footer-total");
const expenseCount     = document.getElementById("expense-count");

const chartCard        = document.getElementById("chart-card");
const chartCanvas      = document.getElementById("expense-chart");
const toast            = document.getElementById("toast");

// ============================================================
// Utilities
// ============================================================

/** Format a number as USD currency */
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Generate a simple unique ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Show a toast notification */
let toastTimer = null;
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// ============================================================
// LocalStorage
// ============================================================

/** Save current state to localStorage */
function saveToStorage() {
  localStorage.setItem(SALARY_KEY,   JSON.stringify(salary));
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

/** Load saved state from localStorage on page load */
function loadFromStorage() {
  const savedSalary   = localStorage.getItem(SALARY_KEY);
  const savedExpenses = localStorage.getItem(EXPENSES_KEY);

  if (savedSalary !== null) {
    const parsed = parseFloat(JSON.parse(savedSalary));
    if (!isNaN(parsed) && parsed > 0) {
      salary = parsed;
      salaryInput.value = parsed;
    }
  }

  if (savedExpenses !== null) {
    try {
      const parsed = JSON.parse(savedExpenses);
      if (Array.isArray(parsed)) expenses = parsed;
    } catch {
      expenses = [];
    }
  }
}

// ============================================================
// Calculations
// ============================================================

function getTotalExpenses() {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

function getBalance() {
  return salary - getTotalExpenses();
}

// ============================================================
// UI Updates
// ============================================================

/** Update the three summary cards */
function updateSummaryCards() {
  const total   = getTotalExpenses();
  const balance = getBalance();

  displaySalary.textContent  = formatCurrency(salary);
  displayTotal.textContent   = formatCurrency(total);
  displayBalance.textContent = formatCurrency(balance);

  // Style the balance card differently when overbudget
  if (balance < 0) {
    balanceCard.classList.add("negative");
    displayBalance.style.color = "";   // controlled by .negative CSS
  } else {
    balanceCard.classList.remove("negative");
    displayBalance.style.color = "var(--success)";
  }
}

/** Re-render the full expense list */
function renderExpenseList() {
  // Clear existing items
  expenseList.innerHTML = "";

  if (expenses.length === 0) {
    emptyState.style.display  = "flex";
    expenseFooter.style.display = "none";
    expenseCount.style.display  = "none";
  } else {
    emptyState.style.display  = "none";
    expenseFooter.style.display = "flex";
    expenseCount.style.display  = "inline-block";

    expenseCount.textContent =
      expenses.length + " item" + (expenses.length !== 1 ? "s" : "");

    // Build each list item using createElement (no innerHTML for items)
    expenses.forEach((expense) => {
      const li = document.createElement("li");
      li.className = "expense-item";
      li.setAttribute("data-id", expense.id);

      const info = document.createElement("div");
      info.className = "expense-info";

      const nameEl = document.createElement("span");
      nameEl.className = "expense-name";
      nameEl.textContent = expense.name;

      const amtEl = document.createElement("span");
      amtEl.className = "expense-amount";
      amtEl.textContent = formatCurrency(expense.amount);

      info.appendChild(nameEl);
      info.appendChild(amtEl);

      const delBtn = document.createElement("button");
      delBtn.className = "btn-delete";
      delBtn.setAttribute("aria-label", "Delete " + expense.name);
      delBtn.textContent = "🗑️";

      // Delete button click → remove expense
      delBtn.addEventListener("click", () => deleteExpense(expense.id));

      li.appendChild(info);
      li.appendChild(delBtn);
      expenseList.appendChild(li);
    });

    footerTotal.textContent = formatCurrency(getTotalExpenses());
  }
}

/** Show or hide the chart card and (re)draw the chart */
function updateChart() {
  if (salary <= 0) {
    chartCard.style.display = "none";
    return;
  }

  chartCard.style.display = "block";

  const totalExp  = getTotalExpenses();
  const remaining = Math.max(getBalance(), 0);
  const expValue  = Math.min(totalExp, salary);

  // Destroy the previous chart instance to avoid duplicate canvas errors
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels: ["Total Expenses", "Remaining Balance"],
      datasets: [{
        data: [expValue, remaining],
        backgroundColor: ["hsl(330,70%,58%)", "hsl(163,72%,45%)"],
        borderColor:     ["hsl(330,70%,48%)", "hsl(163,72%,35%)"],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 14,
            font: { size: 12 },
            color: "#6b7280",
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const value = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return " " + ctx.label + ": " + formatCurrency(value) + " (" + pct + "%)";
            },
          },
        },
      },
    },
  });
}

/** Master refresh — call after any data change */
function refreshUI() {
  updateSummaryCards();
  renderExpenseList();
  updateChart();
}

// ============================================================
// Actions
// ============================================================

/** Set the salary from the input field */
function setSalary() {
  const value = parseFloat(salaryInput.value);

  if (!salaryInput.value.trim()) {
    showToast("Please enter a salary amount.", true);
    return;
  }
  if (isNaN(value) || value <= 0) {
    showToast("Salary must be a positive number.", true);
    return;
  }

  salary = value;
  saveToStorage();
  refreshUI();
  showToast("Salary set to " + formatCurrency(value) + ".");
}

/** Add a new expense from the input fields */
function addExpense() {
  const name   = expenseNameInput.value.trim();
  const amount = parseFloat(expenseAmtInput.value);

  if (!name) {
    showToast("Please enter an expense name.", true);
    return;
  }
  if (!expenseAmtInput.value.trim() || isNaN(amount) || amount <= 0) {
    showToast("Expense amount must be a positive number.", true);
    return;
  }

  // Push to expenses array
  expenses.push({ id: generateId(), name, amount });

  // Clear inputs
  expenseNameInput.value = "";
  expenseAmtInput.value  = "";

  saveToStorage();
  refreshUI();
  showToast(name + " (" + formatCurrency(amount) + ") added.");
}

/** Remove an expense by its ID */
function deleteExpense(id) {
  expenses = expenses.filter((e) => e.id !== id);
  saveToStorage();
  refreshUI();
}

// ============================================================
// Event Listeners
// ============================================================

btnSetSalary.addEventListener("click", setSalary);
btnAddExpense.addEventListener("click", addExpense);

// Allow pressing Enter to trigger buttons
salaryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") setSalary();
});
expenseNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addExpense();
});
expenseAmtInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addExpense();
});

// ============================================================
// Init — load from storage and render on page load
// ============================================================
loadFromStorage();
refreshUI();