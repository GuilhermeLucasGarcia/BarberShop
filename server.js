const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Helper functions for data access
const dataPath = (file) => path.join(__dirname, 'data', file);

const readJson = (file) => {
    try {
        if (!fs.existsSync(dataPath(file))) return [];
        const content = fs.readFileSync(dataPath(file), 'utf8');
        return content ? JSON.parse(content) : [];
    } catch (e) {
        console.error(`Error reading ${file}:`, e);
        return [];
    }
};

const writeJson = (file, data) => {
    try {
        fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error writing ${file}:`, e);
    }
};

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Ensure users.json exists or create default
    let users = readJson('users.json');
    if (users.length === 0) {
        users = [{ username: 'admin', password: '123' }];
        writeJson('users.json', users);
    }
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        res.json({ success: true, token: 'mock-token-' + Date.now(), username: user.username });
    } else {
        res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
});

// Services Endpoint
app.get('/api/services', (req, res) => {
    res.json(readJson('services.json'));
});

// Slots Endpoint (Mock logic)
app.get('/api/slots', (req, res) => {
    const { date, serviceId } = req.query;
    if (!date) return res.json([]);

    // Generate slots from 09:00 to 18:00
    const slots = [];
    for (let h = 9; h < 18; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
    }

    // Filter out booked slots (only confirmed or pending)
    const bookings = readJson('bookings.json');
    const bookedTimes = bookings
        .filter(b => b.date === date && b.status !== 'canceled')
        .map(b => b.time);
    
    const available = slots.filter(time => !bookedTimes.includes(time));
    res.json(available);
});

// Bookings Endpoint (Create)
app.post('/api/bookings', (req, res) => {
    const booking = req.body;
    
    // Validate required fields
    if (!booking.date || !booking.time || !booking.serviceId || !booking.name) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const bookings = readJson('bookings.json');
    
    // Check double booking
    const conflict = bookings.find(b => 
        b.date === booking.date && 
        b.time === booking.time && 
        b.status !== 'canceled'
    );
    
    if (conflict) {
        return res.status(400).json({ error: 'Horário já reservado' });
    }

    const newBooking = {
        id: Date.now(),
        ...booking,
        status: 'confirmed', // default status
        createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);
    writeJson('bookings.json', bookings);
    
    res.json({ success: true, booking: newBooking });
});

// Get User Bookings (Search/Filter)
app.get('/api/bookings', (req, res) => {
    const { username, startDate, endDate, status, serviceId, sort, page = 1, limit = 10 } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Usuário não identificado' });
    }

    let bookings = readJson('bookings.json');
    
    // Filter by user
    bookings = bookings.filter(b => b.username === username);

    // Filter by Date Range
    if (startDate) bookings = bookings.filter(b => b.date >= startDate);
    if (endDate) bookings = bookings.filter(b => b.date <= endDate);

    // Filter by Status
    if (status) bookings = bookings.filter(b => b.status === status);

    // Filter by Service
    if (serviceId) bookings = bookings.filter(b => b.serviceId === serviceId);

    // Sort
    bookings.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return sort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Pagination
    const total = bookings.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = bookings.slice(startIndex, endIndex);

    res.json({
        data: results,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Update Booking (Cancel/Reschedule)
app.patch('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const bookings = readJson('bookings.json');
    
    const index = bookings.findIndex(b => b.id == id);
    if (index === -1) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    // If updating time/date, check conflicts
    if ((updates.date && updates.date !== bookings[index].date) || (updates.time && updates.time !== bookings[index].time)) {
        const targetDate = updates.date || bookings[index].date;
        const targetTime = updates.time || bookings[index].time;
        
        const conflict = bookings.find(b => 
            b.id != id && 
            b.date === targetDate && 
            b.time === targetTime && 
            b.status !== 'canceled'
        );
        
        if (conflict) {
            return res.status(400).json({ error: 'Novo horário indisponível' });
        }
    }

    bookings[index] = { ...bookings[index], ...updates };
    writeJson('bookings.json', bookings);

    res.json({ success: true, booking: bookings[index] });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});