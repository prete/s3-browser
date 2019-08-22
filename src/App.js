import React from "react";
import "antd/dist/antd.css";
import { Drawer, Typography, message, Modal, Table, Tag, Button, Icon, Tooltip} from "antd";
import moment from "moment";


class App extends React.Component {

  bucket = {
    key: '',
    type: 'bucket',
    url: `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}`,
    children:[]
  };

  //do I even need to use the whole state-thing?
  state = {
    bucket: this.bucket,
    search: {
      fetching: false,
      visible: false,
      results: []
    },
    fetching: false,
    breadcrumbs: ''
  };

  browserUrl = `${this.bucket.url}${window.location.pathname}`;

  constructor(props) {
    super(props);
  
    // parse querystring to see if this is a shared link
    if(window.location.search){
      let params = window.location.search
        .slice(1)
        .split('&')
        .map(p => p.split('='))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      if('shared' in params){
        this.bucket.key = params.shared;
      }
    }
  }

  //when the component is mounted => go get bucket data
  componentDidMount() {
    console.log("ComponentDidMount");

    // fetch base level files and fodlers
    this.getAllTheData({prefix: this.bucket.key}).then(data =>{
      this.setupBucket(data);
    });
  }

  setupBucket(data){
    // create the bucket structure
    this.bucket = {
      ...this.bucket,
      name: this.getNodeValue('Name', data),
      share: `${this.browserUrl}`
    };
    
    // set the window title with the bucket name
    window.document.title = window.document.title + ' | ' + this.bucket.name + this.bucket.key;

    this.setState(state => {
      let breadcrumbsPath = '';
      state.breadcrumbs = <span>
        <a href={this.browserUrl}>{this.bucket.name}</a>
        {
          this.state.bucket.key.replace(/\/$/,"").split('/').map(bread => {
            breadcrumbsPath += bread + '/';
            return <span>/ <a href={this.browserUrl+'?share='+breadcrumbsPath}>{bread}</a> / </span>
          })
        }
        </span>;
      return state;
    });

    this.addChildren(data, this.bucket);
    //this.getFolderContents(this.bucket);
  }

  async getAllTheData(options){
    this.setState( state => {
      state.fetching = true;
      return state;
    });

    var data = await this.request(options);
    while(this.getNodeValue('IsTruncated', data) === 'true'){
      var marker = this.getNodeValue('NextMarker', data);
      data += await this.request({
        prefix: options.prefix, 
        marker: marker
      });
    };

    this.setState( state => {
      state.fetching = false;
      return state;
    });

    return data;
  }


  async request(options){
    options = {...options};
    options.prefix = 'prefix' in options ? options.prefix : '';
    
    console.log("Request Options", options);

    let params = [];
    params.push(`delimiter=/`);
    params.push(`prefix=${options.prefix}`);
    if(options.marker){
      params.push(`marker=${options.marker}`);
    }
    
    try {
      const url = this.bucket.url +"?"+params.join("&");
      const request = await fetch(url);
      const text = await request.text();
      return (new window.DOMParser()).parseFromString(text, "text/xml");
    }
    catch (e) {
      return console.error(e);
    }
  }

  async getFolderContents(folder, cb){
    if(folder.type === "file" || folder.loaded){
      return;
    }

    let data = await this.getAllTheData({prefix: folder.key});
    let files = this.getFilesFromXML(data);      
    folder.children.push(...files);
    //this.insertOrdered(...files, folder.children);
    let childrenOfFolder = this.getFoldersFromXML(data);
    for(let childFolder of childrenOfFolder){
      //this.insertOrdered(childFolder, folder.children);
      folder.children.push(childFolder);
    }

    folder.children.sort(this.sorter);
    folder.loaded = true;

    if(cb) {
      cb();
    }
  }

  addChildren(data, folder){
    let files = this.getFilesFromXML(data);      
    folder.children.push(...files);
    //this.insertOrdered(...files, folder.children);
    let childrenOfFolder = this.getFoldersFromXML(data);
    for(let childFolder of childrenOfFolder){
      //this.insertOrdered(childFolder, folder.children);
      folder.children.push(childFolder);
    }

    folder.children.sort(this.sorter);
    folder.loaded = true;

    this.setState(state => {
      state.bucket = this.bucket;
      return state;
    })
  }


  // read the XML and get the Contents (files)
  // fitler the files if this is from a shared link
  getFilesFromXML(data){
    let contents = data.getElementsByTagName("Contents");
    let files = [];
    for(let c of contents){
      files.push(this.parseContents(c));      
    }
    return files;
  }

  // read the XML and get the Contents (files)
  // fitler the files if this is from a shared link
  getFoldersFromXML(data){
    let prefixes = data.getElementsByTagName("CommonPrefixes");
    let folders = [];
    for(let p of prefixes){
      folders.push(this.parseCommonPrefixes(p));
    }
    return folders;
  }

  // helper to get the node value from an element
  getNodeValue(tag, element) {
    return element.getElementsByTagName(tag)[0].childNodes[0].nodeValue;
  }

  // parse <Contents> element to get file information
  parseContents(item) {
    var file = {
      key: this.getNodeValue("Key", item),
      modified: this.getNodeValue("LastModified", item),
      size: parseInt(this.getNodeValue("Size", item)),
      type: "file"
    };
    file.name = file.key.split("/").pop();
    file.extension = file.name.split(".").pop();
    file.url = `${this.bucket.url}/${file.key}`;
    file.share = file.url;
    return file;
  }

  // parse <CommonPrefixes> element to get folder names
  parseCommonPrefixes(item){
    var folder = {
      type: "folder",
      size: 0,
      key: this.getNodeValue("Prefix", item),
      loaded: false,
      children: []
    }
    folder.name = folder.key.replace(/\/$/,"").split("/").pop();
    folder.share = `${this.browserUrl}?shared=${folder.key}`;
    return folder;
  }

  sorter(a, b) {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    } else {
      return a.type === "folder" ? -1 : 1;
    }
  }

  insertOrdered(newItem, collection){
    console.log(newItem, collection);
    for (let i = 0, len = collection.length; i < len; i++) {
      let otherItem = collection[i];
      if ((newItem.type === otherItem.type) && (newItem.name.localeCompare(otherItem.name)<1)) {
        collection.splice(i, 0, newItem);
        break;
      } else if(newItem.type === "folder"){
          collection.splice(i, 0, newItem);
        break;
      }
    }
  }
  
  
  /////////////////////////

  //bytes to human readable
  //src: https://stackoverflow.com/questions/20459630/javascript-human-readable-filesize
  readableFileSize(size) {
    if (size === 0) return "0.00 B";
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (
      (size / Math.pow(1024, i)).toFixed(2) * 1 +
      " " +
      ["B", "kB", "MB", "GB", "TB"][i]
    );
  }

  // onRowClick = (record, index, event) => {
  //   console.log("Row click", { record: record, index: index, event: event });
  //   this.getFolderContents(record);
    
  //   this.setState(state => {
  //     state.bucket = this.bucket;
  //     return state;
  //   });
  // };

  columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: "50%",
      render: (name, record, index) => {
        if(this.state.searching){
          return (
            <div style={{marginLeft: '5px', display: 'block'}}>
              <span>{name}</span><br/>
              <span style={{fontSize: '10px'}}>{record.key.substr(0, record.key.lastIndexOf('/'))}</span>
            </div>)
        }else{
          return <span style={{marginLeft: '5px'}}>{name}</span>;            
        }
      }
    },
    {
      title: "Actions",
      key: "actions",
      width: "10%",
      render: (key, record, index) => {
        let download = (
          <Tooltip title={`Download this ${record.type}: ${record.name}`}>
            <Button icon="download" shape="round" onClick={this.handleDownload.bind(null, record)}/>
          </Tooltip>
        );
        return (
          <Button.Group size="small">
            <Tooltip title={`Share this ${record.type}: ${record.name}`}>
              <Button icon="link" shape="round" onClick={this.handleShare.bind(null, record)}/>
            </Tooltip>
            {record.type === "file" ? download : ""}
          </Button.Group>
        );
      }
    },
    {
      title: "Last Modified",
      dataIndex: "modified",
      key: "modified",
      width: "20%",
      render: (time, record, index) => {
        if (time) {
          return (
            <div>
              <Tag>{moment(time).fromNow()}</Tag>
              <br />
              <small>{time}</small>
            </div>
          );
        } else {
          return "";
        }
      }
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: "20%",
      render: (size, record, index) => {
        let sizeElement;
        if (size) {
          let color = record.type === "file" ? "geekblue" : "";
          sizeElement = (
            <Tag color={color} size="small">
              {this.readableFileSize(size)}
            </Tag>
          );
        } else {
          sizeElement = <span />;
        }
        return sizeElement;
      }
    }
  ];

  fileIcon(ext) {
    let iconName;
    switch (ext) {
      case "pdf":
        iconName = "file-pdf";
        break;
      case "tar":
      case "zip":
      case "gz":
        iconName = "file-zip";
        break;
      case "png":
      case "jpg":
      case "jpge":
      case "tiff":
      case "bmp":
        iconName = "file-image";
        break;
      default:
        iconName = "file-text";
        break;
    }
    return iconName;
  }

  //use different folder and file icons
  folderExpandIcon(props) {
    let iconName;
    let themeName="";
    if (props.record.type === "file") {
      iconName = this.fileIcon(props.record.extension);
    } else if (props.expanded) {
      iconName = "folder-open";
      themeName = "filled";
    } else {
      iconName = "folder";
      themeName = "filled";
    }
    return (<Icon type={iconName} style={{ fontSize: '18px'}} theme={themeName}/>  );
    
  }

  //opens up the modal to show the user the shareable link
  handleShare(record, event){
    Modal.info({
      title: `Share this ${record.type} with others`,
      content: (
        <div>
          <span>Copy the following link:</span>
          <Typography.Paragraph code copyable={{text: record.share, onCopy: f =>(message.success('Link copied!'))}}>{record.share}</Typography.Paragraph>
        </div>
      )
    });
    
    event.stopPropagation();
  }

  //opens a new window with the full S3 file URL
  handleDownload(record, event){
    window.open(record.url);
    event.preventDefault();
  }

  onRowExpand(expanded, record){
    console.log("On row expand");

    this.getFolderContents(record, ()=>{
      this.setState(state => {
        state.bucket = this.bucket;
        return state;
      });
    });
  }

  showDrawer = () => {
    this.setState(state =>{
      state.search = {...state.search, visible: true};
      return state;
    });
  };

  onDrawerClose = () => {
    this.setState(state =>{
      state.search = {...state.search, visible: false};
      return state;
    });
  };


  render() {
    return (
      <div>
        <Typography.Title level={3}>Browsing: {this.state.breadcrumbs}</Typography.Title>    
        <Button type="primary" onClick={this.showDrawer}>Search</Button>
        <Drawer
          title="Search"
          placement="bottom"
          closable={false}
          onClose={this.onDrawerClose}
          visible={this.state.search.visible}>
          
          <Table dataSource={this.state.search.results}>
              <Table.Column title="File" dataIndex="key" key="key"render={key => {
                return (<Tag color="blue" key={key}>{key}</Tag>);
            }}/>
              <Table.Column title="Last modified" dataIndex="modified" key="modified" />
              <Table.Column
                title="Action"
                key="action"
                render={(text, record) => {
                  return (<Button icon="download" shape="round" onClick={this.handleDownload.bind(null, {url: `${this.bucket.url}/${record.key}`})}/>)
                }}
              />
            </Table>
        </Drawer>
        <Table
          size="medium"
          pagination={false}
          expandIcon={this.folderExpandIcon.bind(this)}
          columns={this.columns}
          dataSource={this.state.bucket.children}
          /*onRow={(record, index) => ({
            onClick: this.onRowClick.bind(null, record, index)
          })}*/
          onExpand={this.onRowExpand.bind(this)}
          loading={this.state.fetching}
          expandRowByClick
        />
      </div>
    );
  }
}

export default App;