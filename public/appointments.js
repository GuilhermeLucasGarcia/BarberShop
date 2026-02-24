document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    // DOM Elements
    const listContainer = document.getElementById('appointmentsList');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('errorMsg');
    const paginationEl = document.getElementById('pagination');
    
    // Filter Elements
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const dateStart = document.getElementById('dateFilterStart');
    const dateEnd = document.getElementById('dateFilterEnd');
    const sortOrder = document.getElementById('sortOrder');

    // State
    let currentPage = 1;
    const limit = 5;
    let servicesCache = {};

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        window.location.href = '/login.html';
    });

    // Initial Load
    loadServices().then(() => fetchAppointments());

    // Event Listeners
    searchInput.addEventListener('input', debounce(() => { currentPage = 1; fetchAppointments(); }, 500));
    statusFilter.addEventListener('change', () => { currentPage = 1; fetchAppointments(); });
    dateStart.addEventListener('change', () => { currentPage = 1; fetchAppointments(); });
    dateEnd.addEventListener('change', () => { currentPage = 1; fetchAppointments(); });
    sortOrder.addEventListener('change', () => { currentPage = 1; fetchAppointments(); });

    async function loadServices() {
        try {
            const res = await fetch('/api/services');
            const data = await res.json();
            data.forEach(s => servicesCache[s.id] = s.name);
        } catch (e) {
            console.error('Error loading services', e);
        }
    }

    async function fetchAppointments() {
        showLoading(true);
        errorEl.style.display = 'none';
        listContainer.innerHTML = '';

        try {
            // Build Query Params
            const params = new URLSearchParams({
                username: username,
                page: currentPage,
                limit: limit,
                sort: sortOrder.value
            });

            if (statusFilter.value) params.append('status', statusFilter.value);
            if (dateStart.value) params.append('startDate', dateStart.value);
            if (dateEnd.value) params.append('endDate', dateEnd.value);
            
            // Check cache
            const cacheKey = `appointments_${params.toString()}`;
            const cached = sessionStorage.getItem(cacheKey);
            
            let data;
            
            // Simple cache strategy: valid for 1 minute
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < 60000) {
                    data = parsed.data;
                }
            }

            if (!data) {
                const res = await fetch(`/api/bookings?${params.toString()}`);
                if (!res.ok) throw new Error('Falha ao carregar agendamentos');
                data = await res.json();
                
                // Save to cache
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
            }

            renderAppointments(data.data);
            renderPagination(data.pagination);

        } catch (err) {
            console.error(err);
            errorEl.textContent = 'Não foi possível carregar seus agendamentos. Tente novamente.';
            errorEl.style.display = 'block';
        } finally {
            showLoading(false);
        }
    }

    function renderAppointments(appointments) {
        if (appointments.length === 0) {
            listContainer.innerHTML = '<div class="empty-slots">Nenhum agendamento encontrado.</div>';
            return;
        }

        // Client-side search filtering (since API mock doesn't do fuzzy search on service name)
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = appointments.filter(app => {
            const serviceName = (servicesCache[app.serviceId] || app.serviceId).toLowerCase();
            return !searchTerm || serviceName.includes(searchTerm);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="empty-slots">Nenhum agendamento corresponde à busca.</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(app => {
            const serviceName = servicesCache[app.serviceId] || 'Serviço Personalizado';
            const dateObj = new Date(app.date + 'T' + app.time); // Approximate
            const formattedDate = new Date(app.date).toLocaleDateString('pt-BR');
            
            const statusLabels = {
                'confirmed': 'Confirmado',
                'pending': 'Pendente',
                'canceled': 'Cancelado'
            };

            const isCanceled = app.status === 'canceled';

            return `
                <div class="appointment-card">
                    <div class="appointment-info">
                        <h3>${serviceName}</h3>
                        <div class="appointment-meta">
                            <span>📅 ${formattedDate} às ${app.time}</span>
                            <span class="status-badge status-${app.status}">${statusLabels[app.status] || app.status}</span>
                        </div>
                    </div>
                    <div class="actions">
                        ${!isCanceled ? `
                            <button onclick="cancelAppointment(${app.id})" class="btn btn-small btn-outline" style="color: var(--danger); border-color: var(--danger);">
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPagination(pagination) {
        paginationEl.innerHTML = '';
        if (pagination.totalPages <= 1) return;

        for (let i = 1; i <= pagination.totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === pagination.page ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => {
                currentPage = i;
                fetchAppointments();
                window.scrollTo(0, 0);
            };
            paginationEl.appendChild(btn);
        }
    }

    function showLoading(show) {
        loadingEl.style.display = show ? 'block' : 'none';
        if (show) listContainer.style.display = 'none';
        else listContainer.style.display = 'grid';
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Expose cancel function globally
    window.cancelAppointment = async (id) => {
        if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

        try {
            const res = await fetch(`/api/bookings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'canceled' })
            });

            if (res.ok) {
                // Invalidate cache
                sessionStorage.clear();
                fetchAppointments();
                alert('Agendamento cancelado com sucesso.');
            } else {
                alert('Erro ao cancelar agendamento.');
            }
        } catch (e) {
            alert('Erro de conexão.');
        }
    };
});