const STORAGE_KEY = 'rentalhub_user';

function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY);
}

function showMessage(text, isError = false) {
  const el = document.getElementById('loginMessage');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#dc2626' : '#16a34a';
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const role = document.getElementById('roleInput').value;

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      setCurrentUser(data.user);
      window.location.href = role === 'lender' ? '/lender-dashboard.html' : '/renter-dashboard.html';
    })
    .catch((error) => {
      showMessage(error.message, true);
    });
}

function initializeRoleButtons() {
  const roleButtons = document.querySelectorAll('.role-option');
  const roleInput = document.getElementById('roleInput');

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      roleButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      roleInput.value = button.dataset.role;
    });
  });
}

function navigateToCorrectDashboard(user) {
  if (!user) {
    window.location.href = '/index.html';
    return;
  }

  const isLenderPage = window.location.pathname.includes('lender-dashboard');
  const isRenterPage = window.location.pathname.includes('renter-dashboard');

  if (user.role === 'lender' && !isLenderPage) {
    window.location.href = '/lender-dashboard.html';
  }

  if (user.role === 'renter' && !isRenterPage) {
    window.location.href = '/renter-dashboard.html';
  }
}

function setupDashboardNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.dashboard-section');

  navItems.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Array.from(navItems).indexOf(button);

      navItems.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      sections.forEach((section) => section.classList.remove('active'));
      const pageSections = Array.from(document.querySelectorAll('.dashboard-section'));
      if (pageSections[index]) pageSections[index].classList.add('active');
    });
  });
}

function renderLenderDashboard(data) {
  const user = getCurrentUser();
  document.getElementById('welcomeText').textContent = `Welcome, ${user?.name || 'Lender'}`;
  document.getElementById('profileName').textContent = user?.name || 'Lender Name';
  document.getElementById('profileRole').textContent = 'Role: Lender';

  const listingGrid = document.getElementById('listingGrid');
  listingGrid.innerHTML = (data.listings || []).map((listing) => `
    <article class="listing-card">
      <div class="tag">${listing.status}</div>
      <h4>${listing.title}</h4>
      <p class="meta">${listing.location}</p>
      <p class="meta">${listing.bedrooms} bedrooms · ${listing.type}</p>
      <div class="price">₱${Number(listing.price).toLocaleString()}</div>
      <p class="meta">${listing.description}</p>
    </article>
  `).join('') || '<p>No listings yet.</p>';

  const rentalGrid = document.getElementById('rentalGrid');
  rentalGrid.innerHTML = (data.rentals || []).map((rental) => `
    <article class="listing-card">
      <div class="tag">${rental.status}</div>
      <h4>${rental.listing_title}</h4>
      <p class="meta">Tenant: ${rental.renter_name}</p>
      <p class="meta">From ${rental.start_date} to ${rental.end_date}</p>
    </article>
  `).join('') || '<p>No active rentals.</p>';

  const messageList = document.getElementById('messageList');
  messageList.innerHTML = (data.messages || []).map((msg) => `
    <div class="message-item">
      <p><strong>${msg.sender_name}</strong></p>
      <p>${msg.message}</p>
    </div>
  `).join('') || '<p>No messages yet.</p>';
}

function renderRenterDashboard(data) {
  const user = getCurrentUser();
  document.getElementById('welcomeText').textContent = `Welcome, ${user?.name || 'Renter'}`;
  document.getElementById('profileName').textContent = user?.name || 'Renter Name';
  document.getElementById('profileRole').textContent = 'Role: Renter';

  const browseGrid = document.getElementById('browseGrid');
  browseGrid.innerHTML = (data.listings || []).map((listing) => `
    <article class="listing-card">
      <div class="tag">${listing.status}</div>
      <h4>${listing.title}</h4>
      <p class="meta">${listing.location}</p>
      <p class="meta">${listing.bedrooms} bedrooms · ${listing.type}</p>
      <div class="price">₱${Number(listing.price).toLocaleString()}</div>
      <p class="meta">${listing.description}</p>
    </article>
  `).join('') || '<p>No rentals available.</p>';

  const reservationGrid = document.getElementById('reservationGrid');
  reservationGrid.innerHTML = (data.reservations || []).map((item) => `
    <article class="listing-card">
      <div class="tag">${item.status}</div>
      <h4>${item.listing_title}</h4>
      <p class="meta">Dates: ${item.start_date} to ${item.end_date}</p>
      <div class="price">₱${Number(item.price).toLocaleString()}</div>
    </article>
  `).join('') || '<p>No reservations yet.</p>';

  const favoriteGrid = document.getElementById('favoriteGrid');
  favoriteGrid.innerHTML = (data.favorites || []).map((fav) => `
    <article class="listing-card">
      <h4>${fav.listing_title}</h4>
      <p class="meta">${fav.location}</p>
      <div class="price">₱${Number(fav.price).toLocaleString()}</div>
    </article>
  `).join('') || '<p>No favorites saved.</p>';

  const messageList = document.getElementById('messageList');
  messageList.innerHTML = (data.messages || []).map((msg) => `
    <div class="message-item">
      <p><strong>${msg.sender_name}</strong></p>
      <p>${msg.message}</p>
    </div>
  `).join('') || '<p>No messages yet.</p>';
}

async function loadDashboardData() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = '/index.html';
    return;
  }

  navigateToCorrectDashboard(user);

  const response = await fetch(`/api/dashboard?role=${user.role}&userId=${user.id}`);
  const data = await response.json();

  if (user.role === 'lender') {
    renderLenderDashboard(data);
  } else {
    renderRenterDashboard(data);
  }
}

function attachLogoutHandler() {
  const button = document.getElementById('logoutBtn');
  if (!button) return;

  button.addEventListener('click', () => {
    clearCurrentUser();
    window.location.href = '/index.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeRoleButtons();
  attachLogoutHandler();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (window.location.pathname.includes('lender-dashboard') || window.location.pathname.includes('renter-dashboard')) {
    setupDashboardNav();
    loadDashboardData();
  }
});
