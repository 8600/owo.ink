---
title: vue子组件与父组件通讯
---
1.创建文件Order.js，内容为：
```
"use strict";
import Vue from 'vue';
export var Order = new Vue();
```
2.在父组件里导入Order.js并监听事件,父组件内容为:
```
import { Order } from './Order.js'
// ...
created () {
  Order.$on('tip', (text) => {
    alert(text)
  })
}
```
3.在子组件里导入Order.js并发送事件,子组件内容为:
```
import { Order } from './Order.js'
 // ...
Order.$emit('tip', '123')
```