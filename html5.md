---
title: HTML5
---
### 语义化标签
---

> 用最恰当的HTML元素标记的内容。

优点：

* 提升可访问性
* SEO
* 结构清晰，利于维护

通用容器:

* div 块级通用容器
* span 短语内容无语义容器

`<title></title>`：简短、描述性、唯一（提升搜索引擎排名）。

> 搜索引擎会将title作为判断页面主要内容的指标，有效的title应该包含几个与页面内容密切相关的关键字，建议将title核心内容放在前60个字符中。

`<hn></hn>`：h1~h6分级标题，用于创建页面信息的层级关系。

> 对于搜索引擎而言，如果标题与搜索词匹配，这些标题就会被赋予很高的权重，尤其是h1

`<header></header>`：页眉通常包括网站标志、主导航、全站链接以及搜索框。

> 也适合对页面内部一组介绍性或导航性内容进行标记。

`<nav></nav>`：标记导航，仅对文档中重要的链接群使用。

> Html5规范不推荐对辅助性页脚链接使用nav，除非页脚再次显示顶级全局导航、或者包含招聘信息等重要链接。
<main></main>：页面主要内容，一个页面只能使用一次。如果是web应用，则包围其主要功能。

`<article></article>`：表示文档、页面、应用或一个独立的容器。

> article可以嵌套article，只要里面的article与外面的是部分与整体的关系。

`<section></section>`：具有相似主图的一组内容，比如网站的主页可以分成介绍、新闻条目、联系信息等条块。

> 如果只是为了添加样式，请用div

`<aside></aside>`：指定附注栏，包括引述、侧栏、指向文章的一组链接、广告、友情链接、相关产品列表等。

> 如果放在main内，应该与所在内容密切相关。

`<footer></footer>`：页脚，只有当父级是body时，才是整个页面的页脚。

`<small></small>`：指定细则，输入免责声明、注解、署名、版权。

> 只适用于短语，不要用来不标记“使用条款”，“隐私政策”等长的法律声明。不单纯的样式标签（有意义的，对搜索引擎抓取有强调意义 strong > em > cite）

`<strong></strong>`：表示内容重要性。

`<em></em>`：标记内容着重点（大量用于提升段落文本语义）（斜体）

`<cite></cite>`：指明引用或者参考，如图书的标题，歌曲、电影、等的名称，演唱会、音乐会、规范、报纸、或法律文件等。（斜体）

`<mark></mark>`：突出显示文本（黄色背景颜色），提醒读者

`<figure></figure>`：创建图（默认有40px左右margin）

`<figcaption></figcaption>`：figure的标题，必须是figure内嵌的第一个或者最后一个元素。

`<blockquoto></blockquoto>`：引述文本，默认新的一行显示。

`<time></time>`：标记事件。datetime属性遵循特定格式，如果忽略此属性，文本内容必须是合法的日期或者时间格式。（不再相关的时间用s标签）

`<abbr></abbr>`：解释缩写词。使用title属性可提供全称，只在第一次出现时使用就可以了

`<dfn></dfn>`：定义术语元素，与定义必须紧挨着，可以在描述列表dl元素中使用。

`<address></address>`：作者、相关人士或组织的联系信息（电子邮件地址、指向联系信息页的链接）表示一个具体的地址，字体为斜体，会自动换行

`<del></del>`：移除的内容。 <ins></ins>：添加的内容。

> 少有的既可以包围块级，又可以包围短语内容的元素。

`<code></code>`：标记代码。包含示例代码或者文件名 （< < > >）

`<pre></pre>`：预格式化文本。保留文本固有的换行和空格。

`<meter></meter>`：表示分数的值或者已知范围的测量结果。如投票结果。

> 例如：`<meter value="0.2" title=”Miles“>20%completed</meter>`

`<progress></progress>`：完成进度。可通过js动态更新value。

### 标签新属性
---
#### 细说data dataset(IE11，火狐谷歌)

> 在HTML5中我们可以使用data-前缀设置我们需要的自定义属性，来进行一些数据的存放。通过dataset来获取这些数据。这里的data-前缀就被称为data属性，其可以通过脚本进行定义，也可以应用CSS属性选择器进行样式设置。数量不受限制，在控制和渲染数据的时候提供了非常强大的控制。

#### 一个实例教你如何使用data dataset

```
例如我们要在一个文字按钮上存放相对应的id

下面是元素应用data属性的一个例子：

<div id="food" data-drink="coffee" data-food="sushi" data-meal="lunch">¥20.12</div>
// 要想获取某个属性的值，可以像下面这样使用dataset对象：
var food = document.getElementById('food'); 
var typeOfDrink = food.dataset.drink;
classList(火狐谷歌最新，IE10以上)
obj.classList.add() 添加class类
obj.classList.remove() 移出class类
obj.classList.contains() 判断是否包含指定class类
obj.classList.toggle() 切换class类
obj.classList.length 获取class类的个数
```
#### classList(火狐谷歌最新，IE10以上)

* obj.classList.add() 添加class类
* obj.classList.remove() 移出class类
* obj.classList.contains() 判断是否包含指定class类
* obj.classList.toggle() 切换class类
* obj.classList.length 获取class类的个数

### HTML5新表单
---
#### 新的input类型
email
```
email 类型用于应该包含 e-mail 地址的输入域。在提交表单时，会自动验证 email 域的值。

E-mail: <input type="email" name="user_email" />
```

url
```
url 类型用于应该包含 URL 地址的输入域。在提交表单时，会自动验证 url 域的值。

Homepage: <input type="url" name="user_url" />
```

number
```
number 类型用于应该包含数值的输入域。您还能够设定对所接受的数字的限定：

Points: <input type="number" name="points" min="1" max="10" />
```

range
```
range 类型用于应该包含一定范围内数字值的输入域。range 类型显示为滑动条。您还能够设定对所接受的数字的限定：

<input type="range" name="points" min="1" max="10" />
```

search
```
search 类型用于搜索域，比如站点搜索或 Google 搜索。search 域显示为常规的文本域。
```

#### 新的form属性

autocomplete

```
autocomplete 属性规定 form 或 input 域应该拥有自动完成功能。
注释：autocomplete 适用于 <form> 标签，以及以下类型的 <input> 标签：text, search, url, telephone, email, password, datepickers, range 以及 color。

<form action="demo_form.asp" method="get" autocomplete="on">
    E-mail: <input type="email" name="email" autocomplete="off" />
</form>
```

novalidate
```
novalidate 属性规定在提交表单时不应该验证 form 或 input 域。
注释：novalidate 属性适用于 <form> 以及以下类型的 <input> 标签：text, search, url, telephone, email, password, date pickers, range 以及 color.

<form action="demo_form.asp" method="get" novalidate="true">
    E-mail: <input type="email" name="user_email" />
    <input type="submit" />
</form>
```

#### 新的input属性

autocomplete

```
autocomplete 属性规定 form 或 input 域应该拥有自动完成功能。
注释：autocomplete 适用于 <form> 标签，以及以下类型的 <input> 标签：text, search, url, telephone, email, password, datepickers, range 以及 color。

<form action="demo_form.asp" method="get" autocomplete="on">
    E-mail: <input type="email" name="email" autocomplete="off" />
</form>
```

autofocus

```
autofocus 属性规定在页面加载时，域自动地获得焦点。
注释：autofocus 属性适用于所有 <input> 标签的类型。

User name: <input type="text" name="user_name"  autofocus="autofocus" />
```

form

```
form 属性规定输入域所属的一个或多个表单。
注释：form 属性适用于所有 <input> 标签的类型。
form 属性必须引用所属表单的 id：

<form action="demo_form.asp" method="get" id="user_form">
    First name:<input type="text" name="fname" />
    <input type="submit" />
</form>
Last name: <input type="text" name="lname" form="user_form" />
```

form overrides (formaction, formenctype, formmethod, formnovalidate, formtarget)

```
表单重写属性（form override attributes）允许您重写 form 元素的某些属性设定。
- 表单重写属性有：
    1. formaction - 重写表单的 action 属性
    2. formenctype - 重写表单的 enctype 属性
    3. formmethod - 重写表单的 method 属性
    4. formnovalidate - 重写表单的 novalidate 属性
    5. formtarget - 重写表单的 target 属性
注释：表单重写属性适用于以下类型的 <input> 标签：submit 和 image。

<form action="demo_form.asp" method="get" id="user_form">
E-mail: <input type="email" name="userid" /><br />
<input type="submit" value="Submit" />
<br />
<input type="submit" formaction="demo_admin.asp" value="Submit as admin" />
<br />
<input type="submit" formnovalidate="true" value="Submit without validation" />
<br />
</form>
```

#### height 和 width 属性

```
height 和 width 属性规定用于 image 类型的 input 标签的图像高度和宽度。
注释：height 和 width 属性只适用于 image 类型的 <input> 标签。

<input type="image" src="img_submit.gif" width="99" height="99" />
```

#### list 属性
```
list 属性规定输入域的 datalist。datalist 是输入域的选项列表。
注释：list 属性适用于以下类型的 <input> 标签：text, search, url, telephone, email, date pickers, number, range 以及 color。

Webpage: <input type="url" list="url_list" name="link" />
    <datalist id="url_list">
    <option label="W3Schools" value="http://www.w3school.com.cn" />
    <option label="Google" value="http://www.google.com" />
    <option label="Microsoft" value="http://www.microsoft.com" />
</datalist>
```

#### min、max 和 step 属性

```
min、max 和 step 属性用于为包含数字或日期的 input 类型规定限定（约束）。
max 属性规定输入域所允许的最大值。
min 属性规定输入域所允许的最小值。
step 属性为输入域规定合法的数字间隔（如果 step="3"，则合法的数是 -3,0,3,6 等）。
注释：min、max 和 step 属性适用于以下类型的 <input> 标签：date pickers、number 以及 range。
下面的例子显示一个数字域，该域接受介于 0 到 10 之间的值，且步进为 3（即合法的值为 0、3、6 和 9）：

Points: <input type="number" name="points" min="0" max="10" step="3" />
```

#### multiple 属性

```
multiple 属性规定输入域中可选择多个值。
注释：multiple 属性适用于以下类型的 <input> 标签：email 和 file。

Select images: <input type="file" name="img" multiple="multiple" />
```

#### novalidate 属性

```
novalidate 属性规定在提交表单时不应该验证 form 或 input 域。
注释：novalidate 属性适用于 <form> 以及以下类型的 <input> 标签：text, search, url, telephone, email, password, date pickers, range 以及 color.

<form action="demo_form.asp" method="get" novalidate="true">
    E-mail: <input type="email" name="user_email" />
    <input type="submit" />
</form>
```

#### pattern 属性
```
pattern 属性规定用于验证 input 域的模式（pattern）。
注释：pattern 属性适用于以下类型的 <input> 标签：text, search, url, telephone, email 以及 password。
下面的例子显示了一个只能包含三个字母的文本域（不含数字及特殊字符）：

Country code: <input type="text" name="country_code"
pattern="[A-z]{3}" title="Three letter country code" />
```

#### placeholder 属性
```
placeholder 属性提供一种提示（hint），描述输入域所期待的值。
注释：placeholder 属性适用于以下类型的 <input> 标签：text, search, url, telephone, email 以及 password。
提示（hint）会在输入域为空时显示出现，会在输入域获得焦点时消失：

<input type="search" name="user_search"  placeholder="Search W3School" />
```

#### required 属性

```
required 属性规定必须在提交之前填写输入域（不能为空）。
注释：required 属性适用于以下类型的 <input> 标签：text, search, url, telephone, email, password, date pickers, number, checkbox, radio 以及 file。

Name: <input type="text" name="usr_name" required="required" />
```

### 音频(audio)和视频(video)
---

#### 支持的格式和写法

音频元素支持的3种格式：Ogg MP3 Wav
```
<audio controls>
  <source src="horse.ogg" type="audio/ogg">
  <source src="horse.mp3" type="audio/mpeg">
  您的浏览器不支持 audio 元素。
</audio>
```

视频元素支持三种视频格式：MP4、WebM、Ogg。
```
<video width="320" height="240" controls>
    <source src="movie.mp4" type="video/mp4">
    <source src="movie.ogg" type="video/ogg">
    您的浏览器不支持 video 标签。
</video>
```

#### 标签属性
* 音视频：autoplay、controls、loop、muted、preload、src
* 视频：autoplay、controls、loop、muted、width、height、poster、preload、src

#### 方法
* load():重新加载音频／视频元素
* play()：开始播放音频／视频
* pause()：暂停当前播放的音频／视频

#### 事件
* durationchange:当音频/视频的时长已更改时
* ended:当目前的播放列表已结束时
* pause:当音频/视频已暂停时
* play:当音频/视频已开始或不再暂停时
* ratechange:当音频/视频的播放速度已更改时
* timeupdate:当目前的播放位置已更改时
* volumechange:当音量已更改时

#### 事件属性
1.只读属性
* duration：返回当前的总时长
* currentSrc：返回当前URL
* ended：返回是否已结束
* paused：返回是否已暂停
2.获取并可修改的属性：
* autoplay：设置或返回是否自动播放
* controls：设置或返回是否显示控件（比如播放/暂停等）
* loop：设置或返回是否是循环播放
* muted：设置或返回是否静音
* currentTime：设置或返回当前播放位置（以秒计）
* volume：设置或返回音量（规定音频/视频的当前音量。必须是介于 0.0 与 1.0 之间的数字。）1.0 是最高音量（默认）；0.5 是一半音量 （50%）； 0.0 是静音；
* playbackRate：设置或返回播放速度
