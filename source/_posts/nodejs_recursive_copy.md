---
title: Node.JS循环递归复制文件目录
---
在Node.js中，要实现目录文件夹的循环递归复制也非常简单，使用fs模块即可，仅需几行，而且性能也不错，我们先来实现文件的复制：

```
let fs   = require('fs')
let path = require('path')

let copyFile = function(srcPath, tarPath, cb) {
  let rs = fs.createReadStream(srcPath)
  rs.on('error', function(err) {
    if (err) {
      console.log('read error', srcPath)
    }
    cb && cb(err)
  })

  let ws = fs.createWriteStream(tarPath)
  ws.on('error', function(err) {
    if (err) {
      console.log('write error', tarPath)
    }
    cb && cb(err)
  })
  ws.on('close', function(ex) {
    cb && cb(ex)
  })

  rs.pipe(ws)
}
```
复制目录及其子目录

```
let copyFolder = function(srcDir, tarDir, cb) {
  fs.readdir(srcDir, function(err, files) {
    let count = 0
    let checkEnd = function() {
      ++count == files.length && cb && cb()
    }

    if (err) {
      checkEnd()
      return
    }

    files.forEach(function(file) {
      let srcPath = path.join(srcDir, file)
      let tarPath = path.join(tarDir, file)

      fs.stat(srcPath, function(err, stats) {
        if (stats.isDirectory()) {
          console.log('mkdir', tarPath)
          fs.mkdir(tarPath, function(err) {
            if (err) {
              console.log(err)
              return
            }

            copyFolder(srcPath, tarPath, checkEnd)
          })
        } else {
          copyFile(srcPath, tarPath, checkEnd)
        }
      })
    })

    //为空时直接回调
    files.length === 0 && cb && cb()
  })
}
```
使用时

```
copyFolder('...', '....', function(err) {
  if (err) {
    return
  }

  //continue
})
```