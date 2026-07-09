document.addEventListener('DOMContentLoaded', () => {
  // 卡片hover小动画
  const cards = document.querySelectorAll('.wiki-card, .glass-card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
});