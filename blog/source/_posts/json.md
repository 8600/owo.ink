---
title: JSON
---
**JSON.parse()和JSON.stringify()**

1. JSON.parse(string[, translator]) 将字符串转换为JSON对象

示例代码：
```
var str = '{"name":"叶德华","age":23}';
str = JSON.parse(str);
```

2. JSON.stringify(object[, replacer[, space]])  将JSON对象转为字符串

> 参数：

> object：是要转为字符串的JSON对象。

> replacer：可选，可以是改变字符串转换过程的函数，也可以是一组String和Number对象，这些对象用作一个白名单，用于选择要转换为字符串的对象的属性。如果这个值是空或没有提供，则在所得的JSON字符串中包含对象的所有属性。

> space参数：可选，是一个String或Number对象，用于把空白插入输出的JSON字符串，以提高可读性。如果这是一个数值，则表示用作空白的空格字符数；如果该数值大于10，就取其值为10；小于1的值表示不应使用空格。如果这是一个字符串（如果该字符串多于10个字符，就取前10个字符），就把该字符串用作空白。如果没有提供这个参数（或者为空），就不使用空白。

示例代码：
```
var str = '{"name":"叶德华","age":23}';
str = JSON.parse(str);
console.info(JSON.stringify(str));
console.info(JSON.stringify(str,null,5));
console.info(JSON.stringify(str,["name"],5));
console.info(JSON.stringify(str,null,"###"));
```