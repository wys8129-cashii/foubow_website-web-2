async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // 表单验证
  if (!email.trim()) {
    alert("请输入邮箱");
    return;
  }

  if (!password) {
    alert("请输入密码");
    return;
  }

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      login_password: password
    })
  });

  const result = await res.json();

  if (result.code === 1) {
    localStorage.setItem('isLogin', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('refreshToken', result.data.refresh_token);
    // access_token 有效期 1 小时，提前 5 分钟刷新
    localStorage.setItem('tokenExpiry', Date.now() + 55 * 60 * 1000);

    // 保存用户信息
    if (result.data) {
      localStorage.setItem('userNickname', result.data.nickname || '用户');
      localStorage.setItem('userAvatar', result.data.avatar || '');
    }

    alert("登录成功！");
    location.href = "/index.html";
  } else {
    alert("登录失败：" + (result.msg || "未知错误"));
  }
}

// 页面加载完成后绑定表单提交事件
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }

  // 密码可见性切换
  const toggleBtns = document.querySelectorAll('#loginForm button[type="button"]');
  toggleBtns.forEach(btn => {
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon && icon.textContent.trim() === 'visibility') {
      btn.addEventListener('click', function() {
        const container = this.closest('.relative');
        const input = container.querySelector('input');
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          icon.textContent = isPassword ? 'visibility_off' : 'visibility';
        }
      });
    }
  });
});
