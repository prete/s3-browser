import { testData } from "./RawData";

export default class Bucket {

  constructor(){
    this.bucketUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}`;
    this.url = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}${window.location.pathname}`;
    this.files = [];
    this.bucket = '';
    this.key = '';
    this.tree = {
      name: '',
      key: '/',
      type: 'bucket',
      share: `${this.url}`,
      size: 0,
      children: []
    };

    if(window.location.search){
      this.params = window.location.search
        .slice(1)
        .split('&')
        .map(p => p.split('='))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      if('shared' in this.params){
        this.shared = this.params.shared;
      }
    }
        
    this.getContentes();
  }

  parseContents(item) {
    var foo = {
      key: this.getNodeValue("Key", item),
      modified: this.getNodeValue("LastModified", item),
      size: parseInt(this.getNodeValue("Size", item))
    };
    foo.type = "file";
    foo.name = foo.key.split("/").pop();
    foo.extension = foo.name.split(".").pop();
    foo.url = `${this.bucketUrl}/${foo.key}`;
    foo.share = foo.url;
    return foo;
  }

  addTreeNode(item) {
    var folders = item.key.split("/");
    if(this.shared)
      folders = item.key.replace(this.shared, this.shared.split("/").pop()).split("/");
    folders.pop(); // remove file name
    var path = this.tree;
    while (folders.length !== 0) {
      var folder = folders.shift();
      // eslint-disable-next-line
      var ls = path.children.find(x => x.name === folder);
      if (!ls) {
        ls = {
          name: folder,
          type: "folder",
          size: 0,
          share: `${this.url}?shared=${path.key}/${folder}`,
          key: `${path.key}/${folder}`,
          children: []
        };
        path.children.push(ls);
        path.children.sort(this.sorter);
      }
      ls.size += item.size;
      path = ls;
    }
    
    path.children.push(item);
    path.children.sort(this.sorter);
    this.tree.size += item.size;
  }

  getNodeValue(tag, element) {
    return element.getElementsByTagName(tag)[0].childNodes[0].nodeValue;
  }

  sorter(a, b) {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    } else {
      return a.type === "folder" ? -1 : 1;
    }
  }

  getBucketKey(){
    return `/${this.bucketName}/`;
  }

  fetchBucketData(marker){
    var url = this.bucketUrl;
    if(marker){
      url = `${this.bucketUrl}/?marker=${marker}`;
    }
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    if (request.status === 200) {
      return (new window.DOMParser()).parseFromString(request.responseText, "text/xml");
    }
  }

  getFilesFromXML(data){
    var contents = data.getElementsByTagName("Contents");
    for(let c of contents){
      let file = this.parseContents(c);
      if(!this.shared || file.key.startsWith(this.shared)){
        
        //add file to list
        this.files.push(file);
        this.files.sort(this.sorter);
        
        //add file as leaf to the tree
        this.addTreeNode(file);
      }
    }
  }

  getContentes() {
    var dom = new window.DOMParser();
    var data = dom.parseFromString(testData, "text/xml");
    
    //var data = this.fetchBucketData();
    console.log(data);

    //get base info
    this.bucketName = this.getNodeValue('Name', data);
    this.tree.name = this.bucketName;
    this.tree.key = `/${this.bucketName}`;

    // are we filtering by shared link?
    if(this.shared){
      this.shared = this.shared.replace(this.getBucketKey(), '')
    }

    // build files from xml
    this.getFilesFromXML(data);

    // get all the chunks, repeat until IsTruncated is false
    while(this.getNodeValue('IsTruncated', data) === 'true'){
      var marker = this.getNodeValue('NextMarker', data);
      data = this.fetchBucketData(marker);
      this.getFilesFromXML(data);
    };
    
    this.tree = this.tree.children;
  }
}