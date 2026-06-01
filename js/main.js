// main.js — Grupo Espírita Amor e Vida

(function () {

    // ─── HEADER SCROLL ───────────────────────────────
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // ─── MENU MOBILE ─────────────────────────────────
    const menuToggle = document.getElementById('menuToggle');
    const nav        = document.getElementById('nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('open');
        });

        // Fecha menu ao clicar em link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('open');
            });
        });
    }

    // ─── ANO DINÂMICO NO FOOTER ──────────────────────
    const footerCopy = document.getElementById('footer-copy');
    if (footerCopy) {
        footerCopy.textContent =
            `© ${new Date().getFullYear()} Grupo Espírita Amor e Vida · Goiânia, GO`;
    }

    // ─── FADE-IN AO ROLAR ────────────────────────────
    const fadeEls = document.querySelectorAll(
        '.mc, .ri, .ti-item, .cc, .missao-text, .trabalhos-text, .reunioes-title, .trabalhos-title'
    );

    fadeEls.forEach(el => el.classList.add('fade-in'));

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        fadeEls.forEach(el => observer.observe(el));
    } else {
        fadeEls.forEach(el => el.classList.add('visible'));
    }

    // ─── SMOOTH SCROLL PARA ÂNCORAS ──────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 68;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

})();