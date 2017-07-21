---
title: Meteor
---
1.启动方式 `meteor -p 80`

2.使用nohup后台运行meteor
* nohup meteor -p 80 &
* jobs
* exit

3.meteor数据库启动失败试试
`rm -rf .meteor/local/db/mongod.lock .meteor/local/db/journal/`

4.docker下MongoDB无法启动
[帮助信息](https://github.com/meteor/meteor/issues/4019)

`apt-get install language-pack-en -y`

5.docker下出现`You are attempting to run Meteor as the 'root' superuser`
```
export METEOR_NO_RELEASE_CHECK=true
curl https://install.meteor.com/?release=1.4.1.3 | sh
```