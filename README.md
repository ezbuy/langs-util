### 简介

langs-util 是ezbuy多语言处理的一套工具集，它能够发现指定文件夹中的 gettext 文件，并自动生成pot/po 等多语言资源文件。


### xgettext 依赖安装

```shell
brew install gettext
brew link gettext
```

### 安装

```shell
npm install git+ssh://git@gitlab.1dmy.com:10022/ezbuy/langs-util.git -g 
```

### 使用

- 从src目录开始查找，每个需要多语言的目录生成对应的langs文件夹

```shell
langs-util -i ./src -l th en ms zh id
```

- 从src目录开始查找，每个需要多语言的目录生成到特定的langs文件夹

```shell
langs-util -i ./src -l th en ms zh id -s ./src/langs/index.pot
```