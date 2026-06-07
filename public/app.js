const state = {
  data: null,
  selectedBookingId: null,
  selectedAdminStatus: 'available'
};

const elements = {
  connectionStatus: document.querySelector('#connectionStatus'),
  availableCount: document.querySelector('#availableCount'),
  occupiedCount: document.querySelector('#occupiedCount'),
  reservedCount: document.querySelector('#reservedCount'),
  occupancyRate: document.querySelector('#occupancyRate'),
  revenueTotal: document.querySelector('#revenueTotal'),
  facilityName: document.querySelector('#facilityName'),
  slotGrid: document.querySelector('#slotGrid'),
  bookingForm: document.querySelector('#bookingForm'),
  allocationResult: document.querySelector('#allocationResult'),
  bookingTable: document.querySelector('#bookingTable'),
  resetDemo: document.querySelector('#resetDemo'),
  adminForm: document.querySelector('#adminForm'),
  adminSlot: document.querySelector('#adminSlot'),
  auditLog: document.querySelector('#auditLog'),
  toast: document.querySelector('#toast')
};

connectEvents();
loadState();

elements.bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.bookingForm).entries());
  const result = await api('/api/bookings', {
    method: 'POST',
    body: payload
  });
  state.selectedBookingId = result.booking.id;
  showToast(`Allocated ${result.slot.id} on Floor ${result.slot.floor}`);
  await loadState();
});

elements.resetDemo.addEventListener('click', async () => {
  await api('/api/demo/reset', { method: 'POST' });
  state.selectedBookingId = null;
  showToast('Demo data reset');
  await loadState();
});

document.querySelectorAll('.segment').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.segment').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.selectedAdminStatus = button.dataset.status;
  });
});

elements.adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await api(`/api/slots/${elements.adminSlot.value}/status`, {
    method: 'POST',
    body: { status: state.selectedAdminStatus }
  });
  showToast(`Slot ${elements.adminSlot.value} updated`);
  await loadState();
});

async function loadState() {
  const data = await api('/api/state');
  render(data);
}

function connectEvents() {
  const source = new EventSource('/api/events');
  source.addEventListener('open', () => setConnection(true));
  source.addEventListener('error', () => setConnection(false));
  source.addEventListener('state', (event) => {
    render(JSON.parse(event.data));
  });
}

function setConnection(isLive) {
  elements.connectionStatus.innerHTML = `<span class="pulse"></span>${isLive ? 'Live' : 'Reconnecting'}`;
}

function render(data) {
  state.data = data;
  elements.availableCount.textContent = data.stats.available;
  elements.occupiedCount.textContent = data.stats.occupied;
  elements.reservedCount.textContent = data.stats.reserved;
  elements.occupancyRate.textContent = `${data.stats.occupancyRate}%`;
  elements.revenueTotal.textContent = formatMoney(data.stats.revenue);
  elements.facilityName.textContent = `${data.facility.name} - ${data.facility.location}`;
  renderSlots(data.slots);
  renderBookings(data.bookings);
  renderAdminSlots(data.slots);
  renderAudit(data);
  renderSelectedBooking(data.bookings);
}

function renderSlots(slots) {
  const grouped = slots.reduce((sections, slot) => {
    const section = getCampusSection(slot.id);
    sections[section.key] ||= { ...section, slots: [] };
    sections[section.key].slots.push(slot);
    return sections;
  }, {});

  elements.slotGrid.innerHTML = Object.values(grouped).map((section) => `
    <section class="parking-section section-${section.key}" aria-label="${section.title}">
      <header>
        <div>
          <h3>${section.title}</h3>
          <p>${section.description}</p>
        </div>
        <span class="badge">${section.slots.length} slots</span>
      </header>
      <div class="slot-grid">
        ${section.slots.map(renderSlotButton).join('')}
      </div>
    </section>
  `).join('');
}

function renderSlotButton(slot) {
  const selected = selectedBooking()?.slotId === slot.id ? ' selected' : '';
  return `
    <button class="slot ${slot.status}${selected}" type="button" data-slot="${slot.id}">
      <strong>${slot.id}</strong>
      <span>Floor ${slot.floor} - ${slot.zone}</span>
      <small>${titleCase(slot.vehicleType)} - D${slot.distanceIndex}</small>
    </button>
  `;
}

function getCampusSection(slotId) {
  const prefix = slotId.charAt(0).toLowerCase();
  const sections = {
    a: {
      key: 'a',
      title: 'A Block Parking',
      description: 'Cars near Academic Block'
    },
    b: {
      key: 'b',
      title: 'B Block Parking',
      description: 'SUVs near Food Court'
    },
    c: {
      key: 'c',
      title: 'VIP Parking',
      description: 'Admin Block access'
    },
    d: {
      key: 'd',
      title: 'Two-Wheeler Parking',
      description: 'Library side entry'
    },
    e: {
      key: 'e',
      title: 'Service Parking',
      description: 'Workshop and buses'
    }
  };

  return sections[prefix] || {
    key: 'a',
    title: 'General Parking',
    description: 'Campus vehicle zone'
  };
}

function renderBookings(bookings) {
  const activeBookings = bookings.filter((booking) => ['reserved', 'active'].includes(booking.status));

  if (activeBookings.length === 0) {
    elements.bookingTable.innerHTML = `
      <tr>
        <td colspan="5">No active sessions. Create a booking to begin the live demo.</td>
      </tr>
    `;
    return;
  }

  elements.bookingTable.innerHTML = activeBookings.map((booking) => `
    <tr>
      <td>
        <button class="row-link" type="button" data-select="${booking.id}">${booking.id}</button>
      </td>
      <td>${booking.vehicleNumber}<br><small>${booking.driverName}</small></td>
      <td>${booking.slotId}<br><small>${booking.zone}, Floor ${booking.floor}</small></td>
      <td><span class="badge ${booking.status}">${titleCase(booking.status)}</span></td>
      <td>${actionButton(booking)}</td>
    </tr>
  `).join('');

  elements.bookingTable.querySelectorAll('[data-select]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedBookingId = button.dataset.select;
      render(state.data);
    });
  });

  elements.bookingTable.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/bookings/${button.dataset.booking}/${button.dataset.action}`, { method: 'POST' });
      showToast(`Booking ${button.dataset.action.replace('-', ' ')} completed`);
      await loadState();
    });
  });
}

function actionButton(booking) {
  if (booking.status === 'reserved') {
    return `
      <button class="row-action" data-action="check-in" data-booking="${booking.id}" type="button">Check In</button>
      <button class="row-action" data-action="cancel" data-booking="${booking.id}" type="button">Cancel</button>
    `;
  }

  if (booking.status === 'active') {
    return `<button class="row-action" data-action="check-out" data-booking="${booking.id}" type="button">Check Out</button>`;
  }

  return '';
}

function renderSelectedBooking(bookings) {
  let booking = selectedBooking();
  if (!booking) {
    booking = bookings.find((item) => ['reserved', 'active'].includes(item.status));
    state.selectedBookingId = booking?.id || null;
  }

  if (!booking) {
    elements.allocationResult.innerHTML = '<span class="empty-state">No active booking selected.</span>';
    return;
  }

  elements.allocationResult.innerHTML = `
    <div class="ticket">
      <span class="badge ${booking.status}">${titleCase(booking.status)}</span>
      <strong>${booking.slotId}</strong>
      <div class="ticket-grid">
        <span>Driver<b>${booking.driverName}</b></span>
        <span>Vehicle<b>${booking.vehicleNumber}</b></span>
        <span>Zone<b>${booking.zone}</b></span>
        <span>Floor<b>${booking.floor}</b></span>
      </div>
    </div>
  `;
}

function renderAdminSlots(slots) {
  const current = elements.adminSlot.value;
  elements.adminSlot.innerHTML = slots
    .map((slot) => `<option value="${slot.id}">${slot.id} - ${titleCase(slot.status)}</option>`)
    .join('');

  if (current && slots.some((slot) => slot.id === current)) {
    elements.adminSlot.value = current;
  }
}

function renderAudit(data) {
  const logs = data.auditLogs || [];
  elements.auditLog.innerHTML = logs.slice(0, 8).map((log) => `
    <div class="audit-item">
      <b>${titleCase(log.type)}</b><br>
      ${log.message}
    </div>
  `).join('') || '<div class="audit-item">Audit trail is ready.</div>';
}

async function api(url, options = {}) {
  const request = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' }
  };

  if (options.body) {
    request.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, request);
  const data = await response.json();

  if (!response.ok) {
    showToast(data.error || 'Request failed');
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function selectedBooking() {
  return state.data?.bookings.find((booking) => booking.id === state.selectedBookingId);
}

function formatMoney(value) {
  return `Rs ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(value || 0)}`;
}

function titleCase(value) {
  return String(value || '')
    .split(/[-\s]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2800);
}
