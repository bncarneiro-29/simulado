const STORAGE_KEYS = { books: "biblioteca_books_v1", loans: "biblioteca_loans_v1", auth: "biblioteca_auth_v1" };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadData(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : (value ?? fallback);
  } catch { return fallback; }
}
let books = loadData(STORAGE_KEYS.books);
let loans = loadData(STORAGE_KEYS.loans);
let toastTimer;

function saveData() {
  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
  localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans));
}
function makeId() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function activeLoansForBook(bookId) {
  return loans.filter(loan => loan.bookId === bookId && !loan.returnedAt).length;
}
function availableCopies(book) {
  return Math.max(0, Number(book.copies) - activeLoansForBook(book.id));
}
function loanStatus(loan) {
  if (loan.returnedAt) return { label: "Devolvido", className: "returned" };
  if (loan.dueDate < localDate()) return { label: "Atrasado", className: "late" };
  return { label: "Em andamento", className: "active" };
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function openDialog(id) { document.getElementById(id).showModal(); }
function closeDialog(id) { document.getElementById(id).close(); }

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  renderAll();
}
function logout() {
  localStorage.removeItem(STORAGE_KEYS.auth);
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#password").value = "";
}
$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value;
  // Demonstração: em produção, valide credenciais em um servidor seguro.
  if (username === "admin" && password === "admin123") {
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ username, signedInAt: Date.now() }));
    $("#loginError").textContent = "";
    showApp();
  } else {
    $("#loginError").textContent = "Usuário ou senha inválidos.";
  }
});
$("#logoutBtn").addEventListener("click", logout);

const pageTitles = { dashboard: "Visão geral", books: "Acervo de livros", loans: "Empréstimos" };
function navigate(page) {
  $$(".page").forEach(el => el.classList.add("hidden"));
  $(`#${page}Page`).classList.remove("hidden");
  $$(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $("#pageTitle").textContent = pageTitles[page] || "Biblioteca";
  if (page === "loans") renderLoans();
  if (page === "books") renderBooks();
}
$$(".nav-link").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
$$("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.close)));

function renderAll() {
  renderStats();
  renderRecentLoans();
  renderBooks();
  renderLoans();
}
function renderStats() {
  $("#statBooks").textContent = books.length;
  $("#statLoans").textContent = loans.filter(loan => !loan.returnedAt).length;
  $("#statLate").textContent = loans.filter(loan => !loan.returnedAt && loan.dueDate < localDate()).length;
  $("#statAvailable").textContent = books.reduce((sum, book) => sum + availableCopies(book), 0);
}
function bookName(bookId) {
  return books.find(book => book.id === bookId)?.title || "Livro removido";
}
function statusBadge(loan) {
  const status = loanStatus(loan);
  return `<span class="badge ${status.className}">${status.label}</span>`;
}
function renderRecentLoans() {
  const recent = [...loans].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  $("#recentLoans").innerHTML = recent.length ? recent.map(loan => `
    <tr><td>${escapeHTML(bookName(loan.bookId))}</td><td>${escapeHTML(loan.borrower)}</td>
    <td>${formatDate(loan.loanDate)}</td><td>${formatDate(loan.dueDate)}</td><td>${statusBadge(loan)}</td></tr>`).join("") :
    `<tr><td colspan="5" class="empty-cell">Nenhum empréstimo registrado até o momento.</td></tr>`;
}
function renderBooks() {
  const query = ($("#bookSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const filtered = books.filter(book => [book.title, book.author, book.isbn].some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query)));
  $("#bookCount").textContent = `${filtered.length} ${filtered.length === 1 ? "título" : "títulos"}`;
  $("#booksTable").innerHTML = filtered.length ? filtered.map(book => `
    <tr><td>${escapeHTML(book.title)}</td><td>${escapeHTML(book.author)}</td><td>${escapeHTML(book.isbn || "—")}</td>
    <td>${escapeHTML(book.year || "—")}</td><td>${book.copies}</td><td>${availableCopies(book)}</td>
    <td><button class="action-btn" data-edit-book="${book.id}">Editar</button><button class="action-btn danger" data-delete-book="${book.id}">Excluir</button></td></tr>`).join("") :
    `<tr><td colspan="7" class="empty-cell">${query ? "Nenhum livro encontrado para essa busca." : "Nenhum livro cadastrado. Clique em “Novo livro” para começar."}</td></tr>`;
}
function renderLoans() {
  const query = ($("#loanSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const filter = $("#loanFilter")?.value || "all";
  const filtered = [...loans].filter(loan => {
    const status = loanStatus(loan);
    const matchesQuery = `${bookName(loan.bookId)} ${loan.borrower}`.toLocaleLowerCase("pt-BR").includes(query);
    const matchesFilter = filter === "all" || (filter === "active" && !loan.returnedAt) || (filter === "late" && status.className === "late") || (filter === "returned" && !!loan.returnedAt);
    return matchesQuery && matchesFilter;
  }).sort((a, b) => b.createdAt - a.createdAt);
  $("#loansTable").innerHTML = filtered.length ? filtered.map(loan => `
    <tr><td>${escapeHTML(bookName(loan.bookId))}</td><td>${escapeHTML(loan.borrower)}</td>
    <td>${formatDate(loan.loanDate)}</td><td>${formatDate(loan.dueDate)}</td><td>${statusBadge(loan)}</td>
    <td>${loan.returnedAt ? `<span class="muted">Em ${formatDate(loan.returnedAt)}</span>` : `<button class="action-btn" data-return-loan="${loan.id}">Registrar devolução</button>`}</td></tr>`).join("") :
    `<tr><td colspan="6" class="empty-cell">Nenhum empréstimo corresponde aos filtros selecionados.</td></tr>`;
}
$("#bookSearch").addEventListener("input", renderBooks);
$("#loanSearch").addEventListener("input", renderLoans);
$("#loanFilter").addEventListener("change", renderLoans);

$("#newBookBtn").addEventListener("click", () => {
  $("#bookForm").reset();
  $("#bookId").value = "";
  $("#bookCopies").value = "1";
  $("#bookDialogTitle").textContent = "Cadastrar livro";
  openDialog("bookDialog");
});
$("#booksTable").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-book]");
  const deleteButton = event.target.closest("[data-delete-book]");
  if (editButton) {
    const book = books.find(item => item.id === editButton.dataset.editBook);
    if (!book) return;
    $("#bookForm").reset();
    $("#bookId").value = book.id;
    $("#bookTitle").value = book.title;
    $("#bookAuthor").value = book.author;
    $("#bookIsbn").value = book.isbn || "";
    $("#bookYear").value = book.year || "";
    $("#bookCopies").value = book.copies;
    $("#bookDialogTitle").textContent = "Editar livro";
    openDialog("bookDialog");
  }
  if (deleteButton) {
    const book = books.find(item => item.id === deleteButton.dataset.deleteBook);
    if (!book) return;
    if (activeLoansForBook(book.id) > 0) return showToast("Não é possível excluir: existem empréstimos ativos deste livro.");
    if (!confirm(`Deseja excluir o livro “${book.title}”?`)) return;
    books = books.filter(item => item.id !== book.id);
    saveData(); renderAll(); showToast("Livro excluído.");
  }
});
$("#bookForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#bookId").value;
  const copies = Number($("#bookCopies").value);
  const active = id ? activeLoansForBook(id) : 0;
  if (!Number.isInteger(copies) || copies < 1 || copies < active) {
    return showToast(`A quantidade precisa ser um número inteiro e não pode ser menor que ${active} empréstimo(s) ativo(s).`);
  }
  const book = {
    id: id || makeId(),
    title: $("#bookTitle").value.trim(),
    author: $("#bookAuthor").value.trim(),
    isbn: $("#bookIsbn").value.trim(),
    year: $("#bookYear").value,
    copies
  };
  if (!book.title || !book.author) return;
  if (id) books = books.map(item => item.id === id ? book : item);
  else books.push(book);
  saveData(); closeDialog("bookDialog"); renderAll(); showToast(id ? "Livro atualizado com sucesso." : "Livro cadastrado com sucesso.");
});

$("#newLoanBtn").addEventListener("click", () => {
  const available = books.filter(book => availableCopies(book) > 0);
  if (!available.length) return showToast("Não há livros disponíveis. Cadastre livros ou registre devoluções.");
  $("#loanForm").reset();
  $("#loanError").textContent = "";
  $("#loanBook").innerHTML = available.map(book => `<option value="${book.id}">${escapeHTML(book.title)} — ${availableCopies(book)} disponível(is)</option>`).join("");
  const today = localDate();
  const due = new Date(`${today}T12:00:00`);
  due.setDate(due.getDate() + 14);
  $("#loanDate").value = today;
  $("#dueDate").value = localDate(due);
  openDialog("loanDialog");
});
$("#loanForm").addEventListener("submit", event => {
  event.preventDefault();
  const bookId = $("#loanBook").value;
  const loanDate = $("#loanDate").value;
  const dueDate = $("#dueDate").value;
  const book = books.find(item => item.id === bookId);
  if (!book || availableCopies(book) < 1) {
    $("#loanError").textContent = "Este livro não está mais disponível. Feche e selecione outro.";
    return;
  }
  if (!loanDate || !dueDate || dueDate < loanDate) {
    $("#loanError").textContent = "A data prevista de devolução deve ser igual ou posterior à retirada.";
    return;
  }
  loans.push({ id: makeId(), bookId, borrower: $("#borrower").value.trim(), loanDate, dueDate, returnedAt: null, createdAt: Date.now() });
  saveData(); closeDialog("loanDialog"); renderAll(); showToast("Empréstimo registrado com sucesso.");
});
$("#loansTable").addEventListener("click", event => {
  const button = event.target.closest("[data-return-loan]");
  if (!button) return;
  const loan = loans.find(item => item.id === button.dataset.returnLoan);
  if (!loan || loan.returnedAt) return;
  if (!confirm(`Confirmar a devolução de “${bookName(loan.bookId)}” por ${loan.borrower}?`)) return;
  loan.returnedAt = localDate();
  saveData(); renderAll(); showToast("Devolução registrada. Exemplar disponível novamente.");
});

if (loadData(STORAGE_KEYS.auth, null)?.username === "admin") showApp();
else { $("#loginView").classList.remove("hidden"); $("#appView").classList.add("hidden"); }
