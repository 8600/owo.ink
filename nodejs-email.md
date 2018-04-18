---
title: Node.js获取Email
---
POP3POP3全称为Post Office Protocol version3，是TCP/IP协议族的一员，由RFC 1939定义。其主要提供离线处理邮件，这种离线访问的模式是一种存储转发服务，将邮件从邮件服务器传送到客户端，本地的一些移动、标记操作并不影响服务器端。POP3的客户端首先与服务器建立TCP连接(默认端口是110)，随后向服务器发送命令并等待响应。服务器接收客户端的命令并返回响应。这种你来我往的交互方式维持着两者之间的通信并持续到连接终止。


客户端的命令由一个命令和一些参数组成并以空格隔开，以CRLF(Carriage Return-Line Feed:\r\n)对结束。其中命令采用ASCII码，但不区分大小写，区分大小写的是其随后的参数。POP3服务器响应由一个状态码和一个可能跟有附加信息的命令组成，所有响应也是由CRLF对结束。状态码的值分为"positive"("+OK")和"negetive"("-ERR")。当信息发送完毕时，最后一行以结束符(.)加CRLF对。

在整个生命周期中，POP3会话存在的状态有如下几种。当服务器响应命令请求发送授权响应，这一过程为授权(AUTHORIZATION)状态。客户端向服务器发出身份认证并经过服务器确认后就进入了事务（TRANSACTION）状态。这一状态下，服务器获取客户的相关邮件资源，并接收客户端的如下命令：STAT、LIST、RETR、DELE、NOOP、RSET、QUIT 。当客户端发出QUIT命令后，会话会进入更新(UPDATE)状态。在这状态中，服务器会释放上一状态中取得的资源，并终止连接。

![](https://my-owo-ink.b0.upaiyun.com/owo.ink/nodejs-email/1f86d20ff453fb2a49c457b5f96e5.png)

接下来使用node的poplib包来实现POP3客户端的功能。这里我以qq邮件举例，我们先需要把qq邮件服务器的POP3的功能打开，具体可查看相关官方文档。qq邮件的host为'pop.qq.com'，port为995。
```
var POP3Client = require('poplib');
//首先建立连接
var client = new POP3Client(port, host, {
      tlserrs: false, //是否忽略tls errors
      enabletls: true, //传输层安全协议ssl
      debug: true //是否在console输出命令和响应信息
});
```

当然我们需要捕获异常来响应服务器发出的错误码，比如111就是服务器拒绝链接。以及一些程序运行过程的控制。通过这些预警措施能有效控制程序的状态。
```
//network error handler
client.on('error', function(err){
      if(err.errno === 111){
            console.log('Unable to connect to server.');
      }else{
            console.log('Server error occurred.');
      }
      //console错误
      console.log(err);
});
//state invalid handler 处理状态与命令不一致的情况
client.on('invalid-state', function(cmd){
      console.log('Invalid state. You tried calling ', cmd);
});
//locked handler 处理多命令同时进行的问题
client.on('locked', function(cmd){
      console.log('Current conmand has not finished yet. You tried calling ', cmd);
});
```
按照开始所述的POP3服务流程，我们需要先建立与服务器的连接，并进行身份认证才能进行邮件的获取操作。首先获取邮件列表，再获取第一封邮件的内容。这些操作都成功后就发出QUIT命令来退出服务。
```
// connect to the remote server
client.on('connect', function(){
      console.log('CONNECT success');
  //成功建立连接后进入AUTHORIZATION状态，进行身份认证
      client.login(username, password);
});
/**
 * Successfully login
 */
//login handler status Boolean
client.on('login', function(status, rawdata){
      if(status){
            console.log('LOGIN/PASS success.');
            //获取邮件列表
            client.list();
      }else{
            console.log('ERR: LOGIN/PASS failed');
            client.quit();
      }
});
//LIST handler
client.on('list', function(status, msgcount, msgnumber, data, rawdata){
      if(status === false){
            console.log('LIST failed');
            //获取失败，退出服务
            client.quit();
      }else{
            console.log('LIST success with', msgcount, ' element(s).');
            if(msgcount &gt; 0){
      //获取第一封邮件
                  client.retr(1);
            }
      }
});
//RETR handler
client.on('retr', function(status, msgnumber, data, rawdata){
      if(status === true){
            console.log('RETR success', msgnumber);
    //获得后，输出data数据
    console.log('data is ', data);
            client.quit();
      }else{
            console.log('ERR: RETR failed for msgnumber', msgnumber);
      }
});
//QUIT handler
client.on('quit', function(status, rawdata){
      if(status === true){
            console.log('QUIT success');
            process.exit(0);
      }else{
    console.log('ERR: QUIT failed.');
            process.exit(0);
      }
});
```

这个lib的使用非常简单，但对于结果解析的支持基本没有。不能很好满足我们的需求。所以需要替换为另一个比较复杂但功能更多的邮件协议——IMAP。

* IMAPIMAP全称为Internet Message Access Protocol，和POP3一样是邮件访问的协议。现在的版本为IMAP4rev1，和POP3相比主要有以下不同。
* 支持在线和离线操作。IMAP客户端可以一直连接在服务器上，获得更快的响应时间。
* 支持多客户端。提供一种机制让客户能够感知其他当前连接到这个邮箱的用户所做的操作。
* 支持访问消息中的MIME部分。
* 支持在服务器保留消息状态信息。服务器可以跟踪消息状态提供，多个客户在不同时间访问一个邮箱可以感知其他用户所做的操作。
* 支持在服务器上访问多个邮箱。
* 支持服务器端搜索。
* 支持一个定义良好的扩展机制。

IMAP服务包括了一系列操作：邮箱的建立、删除及重命名、检查新邮件、永久删除邮件、设置和清除标志、基于服务器和 MIME 的分析和搜索、有效并有选择的取回邮件属性、文本和部分内容。兼顾这么多功能的IMAP的命令就比POP3多多了。命令的格式也有所不同，客户端的命令带标签前缀，通过客户端定义，node-imap包的前缀为A加数字(数字通过每次操作累加)。而服务器响应用"+"作为前缀，响应的类型分为"OK"成功、"NO"失败、"BAD"错误。

IMAP协议的状态 http://owo-10017157.cossh.myqcloud.com/nodejs-email/c9c3956ac4ce3d6e72da0ba0cb0c6.jpg

IMAP协议的状态类型有4种，通过状态之间转化来理解IMAP的工作流程。如图，建立连接后，连接会进入认证或者未认证状态。如果是预认证的连接状态会进入认证状态，否则处于未认证的状态。认证状态可接收的命令有CAPABILITY、NOOP、LOGOUT、SELECT、EXAMINE、CREATE、DELETE、RENAME、SUBSCRIBE、UNSUBSCRIBE、LIST、LSUB、STATUS和APPEND。，未认证状态可接收的命令有CAPABILITY、NOOP、LOGOUT、STARTTLS、AUTHENTICATE、LOGIN。如果出现不适当的命令引发协议错误，则进入注销状态。进入认证状态后，可以发出SELECT命令来选择邮件，这时连接就进入了选中状态。选择状态相比认证状态也接收CHECK、CLOSE、EXPUNGE、SEARCH、FETCH、STORE、COPY及UID命令。当进行退出命令时，进入注销状态。当服务器发出LOGOUT的响应后，双方断开连接。这些命令可以参考 https://blog.sina.com.cn/s/blog_604124c10100db11.html

我写的例程在node-imap的例子基础上使用mailparser包来解析邮件正文，然后存储到本地磁盘。

node-imap首先需要创建客户端的实例，通过将认证信息和服务器配置传递给它构造函数。这个实例需要监听ready消息，这个消息是在连接状态属于认证状态时才被触发。触发后，我们选择要打开INBOX邮件文件夹，回调中获得到的信息为这个文件夹中的相关消息，比如messages数和文件夹中可使用的flags等。我们接着在这个文件夹中进行搜索命令，当然可以直接就使用搜索命令对这个邮箱进行邮件搜索。我们搜索的条件为未阅邮件以及时间限制，这个方法返回的是匹配的邮件编号。通过邮件编号，我们能获得这个邮件的内容，获取的命令为FETCH。其imap.fetch()来执行，第一个参数是邮件编号数组，第二个参数是指定返回的邮件的部分内容，node-imap也会自动添加来一些信息字段，比如UID、FLAGS、INTERNALDATE。然后我们在等待fetch到的数据传递回来。这一阶段的代码如下。
```
function openInbox(cb){
  imap.openBox('INBOX', true, cb);
};
//等待触发ready
imap.once('ready', function(){
  openInbox(function(err, box){
    if(err){
      //抛出异常 imap处理
      throw err;
    }else{
      console.log('Info: You have %d messages in your INBOX', box.messages.total);
      imap.search(['UNSEEN', [ 'SINCE' , '2015-06-14' ]], function(err, results){
        console.log('Debug: search results is ' + results);
        if(err){
          throw err;
        }else{
          var f = imap.fetch(results, { bodies: '', struct: true });
          //接下来对得到的数据处理
          //...
        }
      }
    }
  }
});
```
监听到'message'消息后，通过Mailparset包来解析邮件内容。为了节省内存消耗，通过steam的方式将数据传递给解析器。解析器再将邮件数据存储起来。
```
f.on('message', function(msg, seqno){
  var mailparser = new MailParser();            
  console.log('Info: Message #%d', seqno);
  var prefix = '(#' + seqno + ')';
  //正文内容的处理
  msg.on('body', function(stream, info){
    console.log('Debug: info.which: ' + info.which);
    if(info.which === 'TEXT'){
      console.log(prefix + 'Body [%s] found, %d total bytes', inspect(info.which), info.size);
    }
    //pipe到mailparse解析器
    stream.pipe(mailparser);
    var buffer = '',
        count = 0;
    stream.on('data', function(chunk){
      count += chunk.length;
      buffer += chunk.toString('utf8');
    });
    //stream结束，向console发出消息
    stream.once('end', function(){
      if(info.which !== 'TEXT'){
        console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
      }else{
        console.log(prefix + 'Body[%s] Finished', inspect(info.which));
      }
    });
    //解析器将获得的数据存储到磁盘。
    mailparser.on("end", function(mail){
      fs.writeFile('msg- ' + seqno + '-body.html', mail.html, function(err){
        if(err){
          throw err;
        }
        console.log('Info: #%d saved!', seqno);
      });
      //如果有附件，则存储起来。
      if(mail.attachments){
        mail.attachments.forEach(function(attachment){
            console.log(attachment.fileName);
            fs.writeFile('msg-' + seqno + '-' + attachment.generatedFileName, attachment.content, function(err){
              if(err){
                throw err;
              }
              console.log('Info: #%d attachment saved!', seqno);
            });
        });                    
      }
  });
});
```
接下来还需要做的事是将邮件数据聚合，以一封完整的格式存储到MongoDB数据库中。
