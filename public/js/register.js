async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm_password").value;
  const nickname = document.getElementById("nickname").value;
  const termsChecked = document.getElementById("terms").checked;

  // 表单验证
  if (!nickname.trim()) {
    alert("请输入用户昵称");
    return;
  }

  if (!email.trim()) {
    alert("请输入邮箱");
    return;
  }

  if (!password) {
    alert("请输入密码");
    return;
  }

  if (password !== confirmPassword) {
    alert("两次输入的密码不一致");
    return;
  }

  if (!termsChecked) {
    alert("请同意服务条款和隐私政策");
    return;
  }

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      login_password: password,
      user_name: nickname
    })
  });

  const result = await res.json();

  if (result.code === 1) {
    alert("注册成功！");
    location.href = "/login.html";
  } else {
    alert("注册失败：" + (result.msg || "未知错误"));
  }
}

// 页面加载完成后绑定表单提交事件
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      register();
    });
  }

  // 密码可见性切换
  document.querySelectorAll('.material-symbols-outlined').forEach(icon => {
    if (icon.textContent.trim() === 'visibility') {
      icon.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input');
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          this.textContent = isPassword ? 'visibility_off' : 'visibility';
        }
      });
    }
  });
});
