const { cozeRegister, cozeLogin } = require("./api/coze");

// 测试注册
async function testRegister() {
  try {
    const result = await cozeRegister({
      email: "222@qq.com",
      loginPassword: "123456",
      userName: "123456",
    });
    console.log("注册成功，Coze 返回结果：", result);
  } catch (err) {
    console.error("注册失败：", err.message);
  }
}

// 测试登录
async function testLogin() {
  try {
    const result = await cozeLogin({
      email: "222@qq.com",
      loginPassword: "123456",
    });
    console.log("登录成功，Coze 返回结果：", result);
  } catch (err) {
    console.error("登录失败：", err.message);
  }
}

// 执行测试
testRegister();
// testLogin(); // 登录测试（需先配置 loginWorkflowId）