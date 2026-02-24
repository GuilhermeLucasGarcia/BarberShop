document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const feedback = document.getElementById('loginFeedback');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            showFeedback('Preencha todos os campos', 'error');
            return;
        }

        // UI Loading State
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';
        feedback.textContent = '';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showFeedback('Login realizado! Redirecionando...', 'success');
                // Store token if needed
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('username', data.username);
                }
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1000);
            } else {
                showFeedback(data.error || 'Falha no login', 'error');
                resetBtn();
            }
        } catch (error) {
            console.error('Login error:', error);
            showFeedback('Erro de conexão com o servidor', 'error');
            resetBtn();
        }
    });

    function showFeedback(msg, type) {
        feedback.textContent = msg;
        if (type === 'error') {
            feedback.style.color = 'var(--danger)';
        } else {
            feedback.style.color = 'var(--success)';
        }
    }

    function resetBtn() {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Entrar';
    }
});