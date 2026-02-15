// login.js - JavaScript untuk halaman login

// Konfigurasi Supabase
const SUPABASE_URL = 'https://jsbqmtzkayvnpzmnycyv.supabase.co'; // Ganti dengan URL Supabase Anda
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o'; // Ganti dengan Anon Key Supabase Anda

// Inisialisasi Supabase client dengan benar
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cek apakah user sudah login
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Login page loaded');
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        console.log('User already logged in, redirecting to admin');
        window.location.href = 'admin.html';
    }
});

// Handle form submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('span');
    const spinner = loginBtn.querySelector('.fa-spinner');
    
    // Reset error
    errorDiv.classList.remove('show');
    
    // Show loading
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    loginBtn.disabled = true;
    
    try {
        console.log('Attempting login for:', email);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        console.log('Login successful');
        // Login berhasil
        showSuccess('Login berhasil! Mengalihkan...');
        
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        // Tampilkan error
        errorDiv.querySelector('span').textContent = error.message || 'Email atau password salah';
        errorDiv.classList.add('show');
        
        // Reset button
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        loginBtn.disabled = false;
    }
});

// Fungsi untuk menampilkan pesan sukses
function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.background = 'rgba(40, 167, 69, 0.1)';
    errorDiv.style.color = '#28a745';
    errorDiv.style.borderColor = '#28a745';
    errorDiv.querySelector('span').textContent = message;
    errorDiv.classList.add('show');
}