(function(){
  const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : (window.location.origin || 'https://barbeariasilva.onrender.com');
  const BADGE_CONTAINER_ID = 'subscriptionStatus';
  const POLL_INTERVAL = 60 * 1000; // 60s

  function getToken() {
    return localStorage.getItem('token');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return dateStr;
    }
  }

  function renderBadge(status, nextDate) {
    const container = document.getElementById(BADGE_CONTAINER_ID);
    if (!container) return;

    if (!status) {
      container.innerHTML = '';
      return;
    }

    const s = status.toString().toLowerCase();
    const cls = (s.includes('ativ') || s === 'ativa' || s === 'active') ? 'ativa'
              : (s.includes('pend') || s === 'pendente') ? 'pendente'
              : (s.includes('cancel') || s === 'cancelada' || s === 'cancelado') ? 'cancelada'
              : (s.includes('susp') || s === 'suspensa' || s === 'suspenso') ? 'suspensa'
              : 'pendente';

    let label = '';
    switch (cls) {
      case 'ativa': label = 'Assinante • Ativa'; break;
      case 'pendente': label = 'Assinante • Pendente'; break;
      case 'cancelada': label = 'Assinante • Cancelada'; break;
      case 'suspensa': label = 'Assinante • Suspensa'; break;
      default: label = 'Assinante';
    }

    const next = nextDate ? (' • Próx: ' + formatDate(nextDate)) : '';

    container.innerHTML = `<div class="subscription-badge ${cls}" title="Status da assinatura: ${status}">${label}${next}</div>`;
  }

  async function fetchStatus() {
    const token = getToken();
    const container = document.getElementById(BADGE_CONTAINER_ID);
    if (!container) return;

    if (!token) {
      container.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/subscricoes-recorrentes/minha-assinatura`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        // Hide badge on errors
        renderBadge(null);
        return;
      }

      const data = await res.json();
      if (!data || !data.success) {
        renderBadge(null);
        return;
      }

      const assin = data.assinatura || null;
      if (!assin) {
        renderBadge(null);
        return;
      }

      const status = assin.status || assin.status_assinatura || assin.status || null;
      const next = assin.proxima_cobranca || assin.proxima_cobranca_pagamento || null;
      renderBadge(status, next);
    } catch (err) {
      console.error('Erro ao buscar status da assinatura:', err);
      renderBadge(null);
    }
  }

  function init() {
    // Initial fetch
    fetchStatus();

    // Polling
    setInterval(fetchStatus, POLL_INTERVAL);

    // If URL contains subscription_result, refresh immediately
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subscription_result')) {
      fetchStatus();
    }

    // Also refresh on storage change (e.g., login/logout)
    window.addEventListener('storage', (e) => {
      if (e.key === 'token') fetchStatus();
    });
  }

  // Auto-init after DOM loaded
  document.addEventListener('DOMContentLoaded', init);
})();