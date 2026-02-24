const serviceSelect = document.getElementById('serviceSelect')
const priceTag = document.getElementById('priceTag')
const dateInput = document.getElementById('dateInput')
const slotsGrid = document.getElementById('slotsGrid')
const nameInput = document.getElementById('nameInput')
const phoneInput = document.getElementById('phoneInput')
const bookBtn = document.getElementById('bookBtn')
const feedback = document.getElementById('feedback')

let services = []
let selectedSlot = null

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function loadServices() {
  const res = await fetch('/api/services')
  services = await res.json()
  serviceSelect.innerHTML = services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  updatePrice()
}

function updatePrice() {
  const id = serviceSelect.value
  const s = services.find(x => x.id === id)
  priceTag.textContent = s ? `R$ ${s.price.toFixed(2)}` : ''
}

async function loadSlots() {
  selectedSlot = null
  renderSlots([])
  const date = dateInput.value
  const serviceId = serviceSelect.value
  if (!date || !serviceId) return
  const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}`)
  const slots = await res.json()
  renderSlots(slots)
}

function renderSlots(slots) {
  slotsGrid.innerHTML = ''
  slots.forEach(t => {
    const el = document.createElement('button')
    el.className = 'slot'
    el.textContent = t
    el.type = 'button'
    el.addEventListener('click', () => {
      selectedSlot = t
      Array.from(slotsGrid.children).forEach(c => c.classList.remove('selected'))
      el.classList.add('selected')
    })
    slotsGrid.appendChild(el)
  })
}

function validateForm() {
  return Boolean(nameInput.value && phoneInput.value && dateInput.value && selectedSlot && serviceSelect.value)
}

async function submitBooking() {
  feedback.textContent = ''
  bookBtn.disabled = true
  try {
    const payload = {
      name: nameInput.value,
      phone: phoneInput.value,
      date: dateInput.value,
      time: selectedSlot,
      serviceId: serviceSelect.value,
      username: localStorage.getItem('username') // Add username to booking
    }
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      feedback.style.color = '#ff5c5c'
      feedback.textContent = err.error || 'Erro ao agendar'
    } else {
      feedback.style.color = '#35c46b'
      feedback.textContent = 'Agendamento confirmado'
      await loadSlots()
      selectedSlot = null
      nameInput.value = ''
      phoneInput.value = ''
    }
  } catch (_) {
    feedback.style.color = '#ff5c5c'
    feedback.textContent = 'Falha de rede'
  } finally {
    bookBtn.disabled = false
  }
}

serviceSelect.addEventListener('change', () => {
  updatePrice()
  loadSlots()
})
dateInput.addEventListener('change', () => loadSlots())
bookBtn.addEventListener('click', () => {
  if (!validateForm()) {
    feedback.style.color = '#ff5c5c'
    feedback.textContent = 'Preencha todos os campos e selecione um horário'
    return
  }
  submitBooking()
})

window.addEventListener('DOMContentLoaded', async () => {
  await loadServices()
  dateInput.value = todayISO()
  loadSlots()
})
