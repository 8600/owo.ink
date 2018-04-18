---
title: ELK系统搭建
---
### CentOS7搭建ELK-6.2.3版本

ELK是ElasticSerach、Logstash、Kibana三款产品名称的首字母集合，用于日志的搜集和搜索。

### 环境规划

本次实战需要两台电脑（或者vmware下的两个虚拟机），操作系统都是CentOS7，它们的身份、配置、地址等信息如下：

|hostname |IP地址| 身份 | 配置 |
|:-------:|:-------------:| :----------:| :----------:|
|ELK-server|192.168.X.X|ELK服务端,接收日志，提供日志搜索服务	双核|4G内存|
|Nginx-server|192.168.X.X|ELK服务端,接收日志，提供日志搜索服务	双核|4G内存|
### 部署情况简介

运行时的部署情况如下图所示：

![效果预览](http://ouqjus79v.bkt.clouddn.com/%E9%83%A8%E7%BD%B2%E5%9B%BE.jpeg)

业务流程：

* 业务请求到达nginx-server机器上的Nginx；
* (2)Nginx响应请求，并在access.log文件中增加访问记录； 
* (3)FileBeat搜集新增的日志，通过LogStash的5044端口上传日志； 
* (4)LogStash将日志信息通过本机的9200端口传入到ElasticSerach； 
* (5)搜索日志的用户通过浏览器访问Kibana，服务器端口是5601； 
* (6)Kibana通过9200端口访问ElasticSerach；

### ELK-server环境搭载

#### 1、安装JDK

首先在elk-server机器上JDK8；

在ELK[官方文档](https://www.elastic.co/guide/en/elasticsearch/hadoop/6.2/requirements.html)

#### 2、创建用户

ElasticSerach要求以非root身份启动，所以我们要创建一个用户：

* 创建用户组：groupadd elk；
* 创建用户加入用户组：useradd elk -g elk；
* 设置ElasticSerach文件夹为用户elk所有：
```
chown -R elasticsearch.elasticsearch /usr/local/work/elasticsearch-6.2.3；
```

#### 3、系统设置

* 设置hostname，打开文件/etc/hostname，将内容改为elk-server 

* 关闭防火墙（如果因为其他原因不能关闭防火墙，也请不要禁止80端口）：
```
systemctl stop firewalld.service
```
* 禁止防火墙自动启动：
```
systemctl disable firewalld.service
```
* 打开文件/etc/security/limits.conf，添加下面四行内容：
```
* soft nofile 65536
* hard nofile 131072
* soft nproc 2048
* hard nproc 4096
```
* 打开文件/etc/sysctl.conf，添加下面一行内容：
```
vm.max_map_count=655360
```
* 加载sysctl配置，执行命令：
```
sysctl -p
```
* 重启电脑。

#### 4、安装文件准备

* 请在ELK官网下载以下文件：
```
elasticsearch-6.2.3.tar.gz；
logstash-6.2.3.tar.gz；
kibana-6.2.3-linux-x86_64.tar.gz；
```
上述三个文件，推荐在CentOS7的命令行输入以下四个命令下载：
```
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-6.2.3.tar.gz
wget https://artifacts.elastic.co/downloads/logstash/logstash-6.2.3.tar.gz
wget https://artifacts.elastic.co/downloads/kibana/kibana-6.2.3-linux-x86_64.tar.gz
```

* 下载完毕后，创建目录/usr/local/work，将刚刚下载的三个文件全部在这个目录下解压，得到以下三个文件夹：

```
/usr/local/work/elasticsearch-6.2.3
/usr/local/work/logstash-6.2.3
kibana-6.2.3-linux-x86_64
```

#### 5、启动ElasticSerach

切换到用户elasticsearch：

```
su elasticsearch
```
进入目录

```
cd /usr/local/work/elasticsearch-6.2.3
```

执行启动命令：

```
bin/elasticsearch -d，
--此时会在后台启动elasticsearch；
```

查看启动日志可执行命令：
```
tail -f /usr/local/work/elasticsearch-6.2.3/logs/elasticsearch.log，
```

大约五到十分钟后启动成功，提示如下：

```
[2018-04-10T15:12:27,392][INFO ][o.e.n.Node               ] initialized
[2018-04-10T15:12:27,392][INFO ][o.e.n.Node               ] [MNb1nGq] starting ...
[2018-04-10T15:12:39,676][INFO ][o.e.t.TransportService   ] [MNb1nGq] publish_address {127.0.0.1:9300}, bound_addresses {[::1]:9300}, {127.0.0.1:9300}
[2018-04-10T15:12:42,772][INFO ][o.e.c.s.MasterService    ] [MNb1nGq] zen-disco-elected-as-master ([0] nodes joined), reason: new_master {MNb1nGq}{MNb1nGq6Tn6VskdKFQckow}{_DglQhgmRsGAF2D7eTfVfg}{127.0.0.1}{127.0.0.1:9300}
[2018-04-10T15:12:42,776][INFO ][o.e.c.s.ClusterApplierService] [MNb1nGq] new_master {MNb1nGq}{MNb1nGq6Tn6VskdKFQckow}{_DglQhgmRsGAF2D7eTfVfg}{127.0.0.1}{127.0.0.1:9300}, reason: apply cluster state (from master [master {MNb1nGq}{MNb1nGq6Tn6VskdKFQckow}{_DglQhgmRsGAF2D7eTfVfg}{127.0.0.1}{127.0.0.1:9300} committed version [1] source [zen-disco-elected-as-master ([0] nodes joined)]])
[2018-04-10T15:12:42,817][INFO ][o.e.g.GatewayService     ] [MNb1nGq] recovered [0] indices into cluster_state
[2018-04-10T15:12:42,821][INFO ][o.e.h.n.Netty4HttpServerTransport] [MNb1nGq] publish_address {127.0.0.1:9200}, bound_addresses {[::1]:9200}, {127.0.0.1:9200}
[2018-04-10T15:12:42,821][INFO ][o.e.n.Node               ] [MNb1nGq] starte
```
执行curl命令检查服务是否正常响应：

```
curl 127.0.0.1:9200
```

收到响应如下：
```
{
	"name" : "MNb1nGq",
		"cluster_name" : "elasticsearch",
		"cluster_uuid" : "ZHkI7PCQTnCqMBM6rhyT5g",
		"version" : {
			"number" : "6.2.3",
			"build_hash" : "c59ff00",
			"build_date" : "2018-04-10T16:06:29.741383Z",
			"build_snapshot" : false,
			"lucene_version" : "7.2.1",
			"minimum_wire_compatibility_version" : "5.6.0",
			"minimum_index_compatibility_version" : "5.0.0"
		},
		"tagline" : "You Know, for Search"
}
```

```
rpm –ivh jdk-8u161-linux-x64.rpm
```

至此，ElasticSerach服务启动成功，接下来是Logstash

#### 6、启动配置和启动Logstash

在目录/usr/local/work/logstash-6.2.3下创建文件default.conf，内容如下：

```
# 监听5044端口作为输入
input {
		beats {
				port => "5044"
		}
}
# 数据过滤
filter {
		grok {
				match => { "message" => "%{COMBINEDAPACHELOG}" }
		}
		geoip {
				source => "clientip"
		}
}
# 输出配置为本机的9200端口，这是ElasticSerach服务的监听端口
output {
		elasticsearch {
				hosts => ["127.0.0.1:9200"]
		}
}
```
(2)、后台启动Logstash服务：
```
nohup bin/logstash -f default.conf –config.reload.automatic &
```

(3)、运行Logstash服务：

```
bin/logstash -e 'input { stdin {} } output { stdout {} }'  
Sending Logstash logs to /usr/local/elasticsearch/files/logstash/logs which is now configured via log4j2.properties.  
。。。返回信息。。。
hello logstash! 
```

(4)、查看启动日志：

```
tail -f logs/logstash-plain.log
```

启动成功的信息如下：

```
[2018-04-10T15:56:35,304][INFO ][logstash.outputs.elasticsearch] Using mapping template from {:path=>nil}
[2018-04-10T15:56:35,333][INFO ][logstash.outputs.elasticsearch] Attempting to install template {:manage_template=>{"template"=>"logstash-*", "version"=>60001, "settings"=>{"index.refresh_interval"=>"5s"}, "mappings"=>{"_default_"=>{"dynamic_templates"=>[{"message_field"=>{"path_match"=>"message", "match_mapping_type"=>"string", "mapping"=>{"type"=>"text", "norms"=>false}}}, {"string_fields"=>{"match"=>"*", "match_mapping_type"=>"string", "mapping"=>{"type"=>"text", "norms"=>false, "fields"=>{"keyword"=>{"type"=>"keyword", "ignore_above"=>256}}}}}], "properties"=>{"@timestamp"=>{"type"=>"date"}, "@version"=>{"type"=>"keyword"}, "geoip"=>{"dynamic"=>true, "properties"=>{"ip"=>{"type"=>"ip"}, "location"=>{"type"=>"geo_point"}, "latitude"=>{"type"=>"half_float"}, "longitude"=>{"type"=>"half_float"}}}}}}}}
[2018-04-10T15:56:35,415][INFO ][logstash.outputs.elasticsearch] New Elasticsearch output {:class=>"LogStash::Outputs::ElasticSearch", :hosts=>["//127.0.0.1:9200"]}
[2018-04-10T15:56:35,786][INFO ][logstash.filters.geoip   ] Using geoip database {:path=>"/usr/local/work/logstash-6.2.3/vendor/bundle/jruby/2.3.0/gems/logstash-filter-geoip-5.0.3-java/vendor/GeoLite2-City.mmdb"}
[2018-04-10T15:56:36,727][INFO ][logstash.inputs.beats    ] Beats inputs: Starting input listener {:address=>"0.0.0.0:5044"}
[2018-04-10T15:56:36,902][INFO ][logstash.pipeline        ] Pipeline started succesfully {:pipeline_id=>"main", :thread=>"#<thread:0x427aed17 run="">"}
[2018-04-10T15:56:36,967][INFO ][org.logstash.beats.Server] Starting server on port: 5044
[2018-04-10T15:56:37,083][INFO ][logstash.agent           ] Pipelines running {:count=>1, :pipelines=>["main"]}</thread:0x427aed17>
```

#### 7、启动配置和启动Kibana

(1)、打开Kibana的配置文件/usr/local/work/kibana-6.2.3-linux-x86_64/config/kibana.yml，

找到下面这行：

```
#server.host: "localhost"
```
改成如下内容：

```
server.host: "本机IP"
```

(2)、进入Kibana的目录：/usr/local/work/kibana-6.2.3-linux-x86_64

(3)、执行启动命令：

```		
nohup bin/kibana &
```

(4)、查看启动日志：

```
tail -f nohup.out
```

以下信息表示启动成功：

```
{"type":"log","@timestamp":"2018-04-10T15:44:59Z","tags":["status","plugin:elasticsearch@6.2.3","info"],"pid":3206,"state":"yellow","message":"Status changed from uninitialized to yellow - Waiting for Elasticsearch","prevState":"uninitialized","prevMsg":"uninitialized"}
{"type":"log","@timestamp":"2018-04-10T15:44:59Z","tags":["status","plugin:console@6.2.3","info"],"pid":3206,"state":"green","message":"Status changed from uninitialized to green - Ready","prevState":"uninitialized","prevMsg":"uninitialized"}
{"type":"log","@timestamp":"2018-04-10T15:45:01Z","tags":["status","plugin:timelion@6.2.3","info"],"pid":3206,"state":"green","message":"Status changed from uninitialized to green - Ready","prevState":"uninitialized","prevMsg":"uninitialized"}
{"type":"log","@timestamp":"2018-04-10T15:45:01Z","tags":["status","plugin:metrics@6.2.3","info"],"pid":3206,"state":"green","message":"Status changed from uninitialized to green - Ready","prevState":"uninitialized","prevMsg":"uninitialized"}
{"type":"log","@timestamp":"2018-04-10T15:45:01Z","tags":["listening","info"],"pid":3206,"message":"Server running at https://localhost:5601"}
{"type":"log","@timestamp":"2018-04-10T15:45:01Z","tags":["status","plugin:elasticsearch@6.2.3","info"],"pid":3206,"state":"green","message":"Status changed from yellow to green - Ready","prevState":"yellow","prevMsg":"Waiting for Elasticsearch"}
```

(5)、在浏览器访问https://192.168.119.132:5601，看到如下页面：

![success](http://ouqjus79v.bkt.clouddn.com/success.jpeg)