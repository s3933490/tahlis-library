// API Base URL
const API_BASE = "";

// State
let books = [];
let allBooks = []; // For search filtering
let appPassword = "";
let selectedPhoto = null;
let displayedBooks = []; // For pagination
let currentPage = 1;
let booksPerPage = 20;
let currentBookForModal = null;
let currentCoverIndex = 0;
let searchTimeout;

// Swipe handling
let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;

// DOM Elements
const loginScreen = document.getElementById("loginScreen");
const appContainer = document.getElementById("appContainer");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const errorMessage = document.getElementById("errorMessage");
const logoutButton = document.getElementById("logoutButton");

// Tabs
const tabButtons = document.querySelectorAll(".tab-button");
const libraryTab = document.getElementById("libraryTab");
const addTab = document.getElementById("addTab");

// Library Tab
const librarySearchInput = document.getElementById("librarySearchInput");
const booksContainer = document.getElementById("booksContainer");
const booksPerPageSelect = document.getElementById("booksPerPageSelect");
const pagination = document.getElementById("pagination");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

// Add Tab - Search
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// Add Tab - Manual
const addBookForm = document.getElementById("addBookForm");
const photoUpload = document.getElementById("photoUpload");
const photoInput = document.getElementById("photoInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");
const removePhoto = document.getElementById("removePhoto");
const bookTitle = document.getElementById("bookTitle");
const bookAuthor = document.getElementById("bookAuthor");
const addBookBtn = document.getElementById("addBookBtn");

// Modal
const coverModal = document.getElementById("coverModal");
const modalBookTitle = document.getElementById("modalBookTitle");
const swiperContainer = document.getElementById("swiperContainer");
const swiperWrapper = document.getElementById("swiperWrapper");
const swiperPagination = document.getElementById("swiperPagination");
const closeModal = document.getElementById("closeModal");
const modalAddCover = document.getElementById("modalAddCover");
const modalDeleteCover = document.getElementById("modalDeleteCover");
const modalDeleteBook = document.getElementById("modalDeleteBook");
const addCoverInput = document.getElementById("addCoverInput");

// Confirmation Modal
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmAuthor = document.getElementById("confirmAuthor");
const confirmCoverPreview = document.getElementById("confirmCoverPreview");
const confirmCoverImage = document.getElementById("confirmCoverImage");
const confirmPhotoUpload = document.getElementById("confirmPhotoUpload");
const confirmPhotoInput = document.getElementById("confirmPhotoInput");
const confirmPhotoPreview = document.getElementById("confirmPhotoPreview");
const confirmPhotoImage = document.getElementById("confirmPhotoImage");
const confirmRemovePhoto = document.getElementById("confirmRemovePhoto");
const confirmAddBook = document.getElementById("confirmAddBook");
const confirmCancel = document.getElementById("confirmCancel");

let selectedSearchBook = null;
let selectedConfirmPhoto = null;

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Toast notification function
function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 8px 24px rgba(107, 142, 111, 0.5);
        z-index: 10000;
        animation: slideUp 0.3s ease;
    `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideDown 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Add animations to head
if (!document.querySelector("#toast-animations")) {
  const style = document.createElement("style");
  style.id = "toast-animations";
  style.textContent = `
        @keyframes slideUp {
            from { transform: translateX(-50%) translateY(100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(0); opacity: 1; }
            to { transform: translateX(-50%) translateY(100%); opacity: 0; }
        }
    `;
  document.head.appendChild(style);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkAuthentication();
  setupEventListeners();
});

function checkAuthentication() {
  const savedPassword = localStorage.getItem("tahli_library_password");
  if (savedPassword) {
    appPassword = savedPassword;
    verifyPassword(savedPassword);
  }
}

async function verifyPassword(password) {
  try {
    const response = await fetch(`${API_BASE}/api/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      appPassword = password;
      localStorage.setItem("tahli_library_password", password);
      showApp();
    } else {
      logout();
    }
  } catch (error) {
    console.error("Verification error:", error);
    logout();
  }
}

function showApp() {
  loginScreen.style.display = "none";
  appContainer.classList.add("authenticated");
  loadBooks();
}

function logout() {
  appPassword = "";
  localStorage.removeItem("tahli_library_password");
  appContainer.classList.remove("authenticated");
  loginScreen.style.display = "flex";
  books = [];
}

// Setup Event Listeners
function setupEventListeners() {
  // Login
  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", logout);

  // Tabs
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      switchTab(tab);
    });
  });

  // Library search
  librarySearchInput.addEventListener("input", filterLibrary);

  // Books per page selector
  booksPerPageSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    booksPerPage = value === "all" ? Infinity : parseInt(value);
    currentPage = 1;
    renderBooks();
  });

  // Pagination
  prevPage.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderBooks();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  nextPage.addEventListener("click", () => {
    const totalPages = Math.ceil(books.length / booksPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderBooks();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Add tab - API search
  searchInput.addEventListener("input", handleAPISearch);
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.remove("show");
    }
  });

  // Add tab - Manual
  photoUpload.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", handlePhotoSelect);
  removePhoto.addEventListener("click", (e) => {
    e.stopPropagation();
    clearPhoto();
  });
  addBookForm.addEventListener("submit", handleAddBook);

  // Modal
  closeModal.addEventListener("click", closeSwipeModal);
  coverModal.addEventListener("click", (e) => {
    if (e.target === coverModal) closeSwipeModal();
  });
  modalAddCover.addEventListener("click", () => addCoverInput.click());
  modalDeleteCover.addEventListener("click", deleteCurrentCover);
  modalDeleteBook.addEventListener("click", deleteCurrentBook);
  addCoverInput.addEventListener("change", handleAddCoverToBook);

  // Confirmation Modal
  confirmPhotoUpload.addEventListener("click", () => confirmPhotoInput.click());
  confirmPhotoInput.addEventListener("change", handleConfirmPhotoSelect);
  confirmRemovePhoto.addEventListener("click", (e) => {
    e.stopPropagation();
    clearConfirmPhoto();
  });
  confirmAddBook.addEventListener("click", handleConfirmAddBook);
  confirmCancel.addEventListener("click", closeConfirmModal);
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeConfirmModal();
  });

  // Swipe handling
  swiperContainer.addEventListener("touchstart", handleTouchStart, {
    passive: true,
  });
  swiperContainer.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });
  swiperContainer.addEventListener("touchend", handleTouchEnd);
}

// Tab Switching
function switchTab(tab) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  libraryTab.classList.toggle("active", tab === "library");
  addTab.classList.toggle("active", tab === "add");
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const password = passwordInput.value.trim();

  if (!password) return;

  try {
    const response = await fetch(`${API_BASE}/api/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      errorMessage.classList.remove("show");
      appPassword = password;
      localStorage.setItem("tahli_library_password", password);
      passwordInput.value = "";
      showApp();
    } else {
      errorMessage.classList.add("show");
      passwordInput.value = "";
    }
  } catch (error) {
    console.error("Login error:", error);
    errorMessage.classList.add("show");
  }
}

// Load Books
async function loadBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      headers: { "x-app-password": appPassword },
    });

    if (response.status === 401) {
      logout();
      return;
    }

    allBooks = await response.json();
    books = [...allBooks];
    renderBooks();
    updateStats();
  } catch (error) {
    console.error("Error loading books:", error);
  }
}

// Filter Library (Search Your Books)
function filterLibrary(e) {
  const query = e.target.value.toLowerCase().trim();

  if (!query) {
    books = [...allBooks];
  } else {
    books = allBooks.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        (book.author && book.author.toLowerCase().includes(query))
    );
  }

  renderBooks();
}

// Render Books
function renderBooks() {
  if (books.length === 0) {
    booksContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <h3>${
                  allBooks.length === 0 ? "No books yet" : "No matches found"
                }</h3>
                <p>${
                  allBooks.length === 0
                    ? "Add your first book!"
                    : "Try a different search"
                }</p>
            </div>
        `;
    pagination.style.display = "none";
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(books.length / booksPerPage);
  const startIndex = (currentPage - 1) * booksPerPage;
  const endIndex = startIndex + booksPerPage;
  displayedBooks = books.slice(startIndex, endIndex);

  // Render books
  booksContainer.innerHTML = displayedBooks
    .map((book) => {
      const coverCount = book.covers.length;

      // Prioritize user covers, fall back to API cover
      let coverImage = "";
      if (book.apiCoverUrl) {
        coverImage = book.apiCoverUrl; // API cover first! ⭐
      } else if (book.covers.length > 0) {
        coverImage = book.covers[0].url; // User photos as fallback
      }

      const hasCover = coverCount > 0;

      const safeTitle = escapeHtml(book.title);
      const safeAuthor = escapeHtml(book.author);

      return `
            <div class="book-card" onclick="openSwipeModal('${book.id}')">
                ${
                  coverImage
                    ? `
                    <img src="${coverImage}" alt="${safeTitle}" class="cover-preview">
                `
                    : `
                    <div class="cover-preview" style="display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--text-light);">
                        📚
                    </div>
                `
                }
                
                <div class="book-info">
                    <div class="book-title">${safeTitle}</div>
                    ${
                      book.author
                        ? `<div class="book-author">by ${safeAuthor}</div>`
                        : ""
                    }
                    
                    <span class="cover-count ${!hasCover ? "no-covers" : ""}">
                        ${
                          hasCover
                            ? `${coverCount} cover${coverCount > 1 ? "s" : ""}`
                            : "No covers yet"
                        }
                    </span>
                    
                    <div class="quick-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon btn-add-cover-quick" onclick="quickAddCover('${
                          book.id
                        }')" title="Add cover">
                            Add Photo
                        </button>
                        <button class="btn-icon btn-view" onclick="openSwipeModal('${
                          book.id
                        }')" title="View">
                            View
                        </button>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");

  // Update pagination controls
  if (totalPages > 1) {
    pagination.style.display = "flex";
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages;
  } else {
    pagination.style.display = "none";
  }
}

// Update Stats
function updateStats() {
  const totalCovers = allBooks.reduce(
    (sum, book) => sum + book.covers.length,
    0
  );
  const multipleCovers = allBooks.filter((b) => b.covers.length > 1).length;

  document.getElementById("totalBooks").textContent = allBooks.length;
  document.getElementById("totalCovers").textContent = totalCovers;
  document.getElementById("multipleCovers").textContent = multipleCovers;
}

// API Search
function handleAPISearch(e) {
  const query = e.target.value.trim();

  clearTimeout(searchTimeout);

  if (query.length < 2) {
    searchResults.innerHTML = "";
    searchResults.classList.remove("show");
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      searchResults.innerHTML = '<div class="loading">Searching...</div>';
      searchResults.classList.add("show");

      const response = await fetch(
        `${API_BASE}/api/search?q=${encodeURIComponent(query)}`
      );
      const results = await response.json();

      if (results.length === 0) {
        searchResults.innerHTML = '<div class="loading">No results found</div>';
        return;
      }

      searchResults.innerHTML = results
        .map((book) => {
          // Define safe variables inside the map
          const safeTitle = escapeHtml(book.title);
          const safeAuthor = escapeHtml(book.author);

          return `
      <div class="search-result-item" onclick='selectSearchResult(${JSON.stringify(
        book
      ).replace(/'/g, "\\'")})'>
        ${
          book.coverUrl
            ? `<img src="${book.coverUrl}" alt="${safeTitle}" class="result-cover">`
            : '<div class="result-cover"></div>'
        }
        <div class="result-info">
          <strong>${safeTitle}</strong>
          <small>${safeAuthor}${
            book.firstPublishYear ? ` • ${book.firstPublishYear}` : ""
          }</small>
        </div>
      </div>
    `;
        })
        .join("");
    } catch (error) {
      console.error("Search error:", error);
      searchResults.innerHTML = '<div class="loading">Search failed</div>';
    }
  }, 300);
}

// Select Search Result - Show Confirmation Modal
window.selectSearchResult = function (book) {
  selectedSearchBook = book;
  selectedConfirmPhoto = null;

  // Populate modal
  confirmTitle.textContent = book.title;
  confirmAuthor.textContent = book.author || "Unknown Author";

  // Show API cover if available
  if (book.coverUrl) {
    confirmCoverImage.src = book.coverUrl;
    confirmCoverPreview.style.display = "block";
  } else {
    confirmCoverPreview.style.display = "none";
  }

  // Reset photo upload
  clearConfirmPhoto();

  // Hide search results and show confirmation
  searchResults.classList.remove("show");
  confirmModal.classList.add("show");
  document.body.classList.add("modal-open");
};

// Handle Confirmation Photo Select
function handleConfirmPhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedConfirmPhoto = file;
  const reader = new FileReader();

  reader.onload = (e) => {
    confirmPhotoImage.src = e.target.result;
    confirmPhotoPreview.style.display = "block";
    confirmPhotoUpload.querySelector(".upload-prompt").style.display = "none";
  };

  reader.readAsDataURL(file);
}

function clearConfirmPhoto() {
  selectedConfirmPhoto = null;
  confirmPhotoInput.value = "";
  confirmPhotoImage.src = "";
  confirmPhotoPreview.style.display = "none";
  if (confirmPhotoUpload.querySelector(".upload-prompt")) {
    confirmPhotoUpload.querySelector(".upload-prompt").style.display = "flex";
  }
}

function closeConfirmModal() {
  confirmModal.classList.remove("show");
  document.body.classList.remove("modal-open");
  selectedSearchBook = null;
  selectedConfirmPhoto = null;
}

// Handle Confirm Add Book
async function handleConfirmAddBook() {
  if (!selectedSearchBook) return;

  confirmAddBook.disabled = true;
  confirmAddBook.textContent = "Adding...";

  try {
    // First, add the book
    const response = await fetch(`${API_BASE}/api/books/from-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-password": appPassword,
      },
      body: JSON.stringify({
        title: selectedSearchBook.title,
        author: selectedSearchBook.author,
        apiCoverUrl: selectedSearchBook.coverUrl,
      }),
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to add book");
    }

    const newBook = await response.json();

    // If user uploaded a photo, add it as a cover
    if (selectedConfirmPhoto) {
      const formData = new FormData();
      formData.append("photo", selectedConfirmPhoto);

      const coverResponse = await fetch(
        `${API_BASE}/api/books/${newBook.id}/covers`,
        {
          method: "POST",
          headers: { "x-app-password": appPassword },
          body: formData,
        }
      );

      if (!coverResponse.ok) {
        console.error("Failed to add cover, but book was added");
      }
    }

    // Close modal and refresh
    closeConfirmModal();
    searchInput.value = "";
    await loadBooks();
    switchTab("library");
    showToast("📚 Book added to library");
  } catch (error) {
    console.error("Error adding book:", error);
    alert("Failed to add book");
  } finally {
    confirmAddBook.disabled = false;
    confirmAddBook.textContent = "Add to Library";
  }
}

// Photo Upload (Manual)
function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedPhoto = file;
  const reader = new FileReader();

  reader.onload = (e) => {
    previewImage.src = e.target.result;
    photoPreview.classList.add("show");
    uploadPrompt.style.display = "none";
    photoUpload.classList.add("has-photo");
  };

  reader.readAsDataURL(file);
}

function clearPhoto() {
  selectedPhoto = null;
  photoInput.value = "";
  previewImage.src = "";
  photoPreview.classList.remove("show");
  uploadPrompt.style.display = "flex";
  photoUpload.classList.remove("has-photo");
}

// Add Book Manually
async function handleAddBook(e) {
  e.preventDefault();

  if (!selectedPhoto) {
    alert("Please take a photo!");
    return;
  }

  const formData = new FormData();
  formData.append("photo", selectedPhoto);
  formData.append("title", bookTitle.value.trim());
  formData.append("author", bookAuthor.value.trim());

  addBookBtn.disabled = true;
  addBookBtn.textContent = "Adding...";

  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      method: "POST",
      headers: { "x-app-password": appPassword },
      body: formData,
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      addBookForm.reset();
      clearPhoto();
      await loadBooks();
      switchTab("library");
      showToast("📚 Book added to library");
    } else {
      const error = await response.json();
      alert(error.error || "Failed to add book");
    }
  } catch (error) {
    console.error("Error adding book:", error);
    alert("Failed to add book");
  } finally {
    addBookBtn.disabled = false;
    addBookBtn.textContent = "Add to Library";
  }
}

// Quick Add Cover
window.quickAddCover = function (bookId) {
  const book = allBooks.find((b) => b.id === bookId);
  if (!book) return;

  currentBookForModal = book;
  addCoverInput.click();
};

// Handle Add Cover to Book
async function handleAddCoverToBook(e) {
  const file = e.target.files[0];
  if (!file || !currentBookForModal) return;

  const formData = new FormData();
  formData.append("photo", file);

  try {
    const response = await fetch(
      `${API_BASE}/api/books/${currentBookForModal.id}/covers`,
      {
        method: "POST",
        headers: { "x-app-password": appPassword },
        body: formData,
      }
    );

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      await loadBooks();

      // If modal is open, refresh it
      if (coverModal.classList.contains("show")) {
        const updatedBook = allBooks.find(
          (b) => b.id === currentBookForModal.id
        );
        if (updatedBook) {
          openSwipeModal(updatedBook.id);
        }
      }

      showToast("📸 Cover added");
    }
  } catch (error) {
    console.error("Error adding cover:", error);
    alert("Failed to add cover");
  } finally {
    addCoverInput.value = "";
  }
}

// Open Swipeable Modal
window.openSwipeModal = function (bookId) {
  const book = allBooks.find((b) => b.id === bookId);
  if (!book) return;

  currentBookForModal = book;
  currentCoverIndex = 0;

  modalBookTitle.textContent = book.title;

  // Build swiper slides
  const covers =
    book.covers.length > 0
      ? book.covers
      : book.apiCoverUrl
      ? [{ url: book.apiCoverUrl, id: "api" }]
      : [];

  if (covers.length === 0) {
    // No covers - prompt to add one
    if (confirm(`"${book.title}" has no covers yet. Add one now?`)) {
      quickAddCover(book.id);
    }
    return;
  }

  // Escape title for HTML safety
  const safeTitle = escapeHtml(book.title);

  swiperWrapper.innerHTML = covers
    .map(
      (cover, index) => `
        <div class="swiper-slide">
            <img src="${cover.url}" alt="${safeTitle}">
            <div class="cover-info">
                <div class="cover-counter">${index + 1} / ${covers.length}</div>
            </div>
        </div>
    `
    )
    .join("");
  // Build pagination
  swiperPagination.innerHTML = covers
    .map(
      (_, index) => `
        <span class="swiper-pagination-bullet ${index === 0 ? "active" : ""}" 
              onclick="goToSlide(${index})"></span>
    `
    )
    .join("");

  // Enable/disable delete button
  modalDeleteCover.style.display = covers[0].id === "api" ? "none" : "block";

  coverModal.classList.add("show");
  document.body.classList.add("modal-open");
  updateSwiper();
};

function closeSwipeModal() {
  coverModal.classList.remove("show");
  document.body.classList.remove("modal-open");
  currentBookForModal = null;
  currentCoverIndex = 0;
}

// Swipe Handling
function handleTouchStart(e) {
  touchStartX = e.touches[0].clientX;
  isDragging = true;
}

function handleTouchMove(e) {
  if (!isDragging) return;

  touchEndX = e.touches[0].clientX;
  const diff = touchStartX - touchEndX;

  // Add resistance
  if (diff !== 0) {
    e.preventDefault();
  }
}

function handleTouchEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  const diff = touchStartX - touchEndX;
  const threshold = 50;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      // Swipe left - next
      nextSlide();
    } else {
      // Swipe right - previous
      prevSlide();
    }
  }
}

function goToSlide(index) {
  if (!currentBookForModal) return;
  const maxIndex = currentBookForModal.covers.length - 1;
  currentCoverIndex = Math.max(0, Math.min(index, maxIndex));
  updateSwiper();
}

function nextSlide() {
  if (!currentBookForModal) return;
  if (currentCoverIndex < currentBookForModal.covers.length - 1) {
    currentCoverIndex++;
    updateSwiper();
  }
}

function prevSlide() {
  if (currentCoverIndex > 0) {
    currentCoverIndex--;
    updateSwiper();
  }
}

function updateSwiper() {
  const offset = -currentCoverIndex * 100;
  swiperWrapper.style.transform = `translateX(${offset}%)`;

  // Update pagination
  document
    .querySelectorAll(".swiper-pagination-bullet")
    .forEach((bullet, index) => {
      bullet.classList.toggle("active", index === currentCoverIndex);
    });

  // Update delete button visibility
  if (currentBookForModal) {
    const currentCover = currentBookForModal.covers[currentCoverIndex];
    modalDeleteCover.style.display =
      currentCover?.id === "api" ? "none" : "block";
  }
}

window.goToSlide = goToSlide;

// Delete Current Cover
async function deleteCurrentCover() {
  if (!currentBookForModal) return;

  const currentCover = currentBookForModal.covers[currentCoverIndex];
  if (!currentCover || currentCover.id === "api") return;

  if (!confirm("Delete this cover photo?")) return;

  try {
    const response = await fetch(`${API_BASE}/api/covers/${currentCover.id}`, {
      method: "DELETE",
      headers: { "x-app-password": appPassword },
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      await loadBooks();

      const updatedBook = allBooks.find((b) => b.id === currentBookForModal.id);
      if (updatedBook && updatedBook.covers.length > 0) {
        // Stay in modal, update it
        if (currentCoverIndex >= updatedBook.covers.length) {
          currentCoverIndex = updatedBook.covers.length - 1;
        }
        openSwipeModal(updatedBook.id);
      } else {
        // No more covers, close modal
        closeSwipeModal();
      }

      showToast("🗑️ Cover deleted");
    }
  } catch (error) {
    console.error("Error deleting cover:", error);
    alert("Failed to delete cover");
  }
}

// Delete Current Book (from modal)
async function deleteCurrentBook() {
  if (!currentBookForModal) return;

  if (!confirm(`Delete "${currentBookForModal.title}" and all its covers?`))
    return;

  try {
    const response = await fetch(
      `${API_BASE}/api/books/${currentBookForModal.id}`,
      {
        method: "DELETE",
        headers: { "x-app-password": appPassword },
      }
    );

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      closeSwipeModal();
      await loadBooks();
      showToast("🗑️ Book deleted");
    }
  } catch (error) {
    console.error("Error deleting book:", error);
    alert("Failed to delete book");
  }
}

window.deleteBook = async function (bookId) {
  if (!confirm("Delete this book and all its covers?")) return;

  try {
    const response = await fetch(`${API_BASE}/api/books/${bookId}`, {
      method: "DELETE",
      headers: { "x-app-password": appPassword },
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      await loadBooks();
      alert("Book deleted");
    }
  } catch (error) {
    console.error("Error deleting book:", error);
    alert("Failed to delete book");
  }
};
