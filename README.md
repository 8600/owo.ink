# 快速启动

请确保您已经有了Node.js版本以上环境

1. 下载最新的Release包
1. 将代码解压出来
1. `npm install --production`安装依赖包
1. 运行博客!
    - 本地环境: `npm start`
    - 生产环境环境: `npm start --production`
1. 管理地址:`http://localhost:2368/ghost` 

<a name="getting-started"></a>
# 开发者安装

首先安装 Node.js.

克隆代码

```bash
git clone https://github.com/PUGE/owo.ink.git
cd owo.ink
```

安装 grunt

```bash
npm install -g grunt-cli
```

安装依赖包.

```bash
npm install
```

编译代码!

```bash
grunt init
```

编译生产代码?

```bash
grunt prod
```

启动工程.

```bash
npm start

## 生产环境? 加上 --production
```
