import { _decorator, Component, Node, Label, EditBox, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RegisterScene')
export class RegisterScene extends Component {
    @property(EditBox)
    private accountEditBox: EditBox = null;
    
    @property(EditBox)
    private passwordEditBox: EditBox = null;

    @property(EditBox)
    private rePasswordEditBox: EditBox = null;

    @property(Node)
    private loginNode: Node = null;
    
    start(){
    }

    // 注册按钮点击事件
    onRegisterBtnClick() {
        const account = this.accountEditBox.string;
        const password = this.passwordEditBox.string;
        const rePassword = this.rePasswordEditBox.string;
        
        //账号判空
        if (account === "") {
            console.log(account + "空的");
            this.showLoginTip("账号不能为空");
            return;
        }
        //密码判空
        if(password === "" || rePassword === ""){
            this.showLoginTip("密码不能为空");
            return;
        }

        if(password === rePassword)
        {
            // 保存到本地存储
            localStorage.setItem("account", account);
            localStorage.setItem("password", password);
            this.showLoginTip("注册成功！");
        }
        
        // 延迟跳转到登录场景
        this.node.active = false;
        this.loginNode.active = true;
    }

    //返回
    reback(){
        this.node.active = false;
        this.loginNode.active = true;
    }

    //系统消息
    showLoginTip(message: string) {
        alert(message);
    }
}

