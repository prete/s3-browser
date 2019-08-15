export default class Bucket {

  // gets the contents from the bucket as a tree
  get tree() {
    return this.bucketRoot.children;
  }

  // gets the contents of the bucket as a tree but returns only the root node
  get root(){
    return this.bucketRoot;
  }

  // gets the files in the bucket
  get files() {
    return this._files;
  }

  get name(){
    return this.bucketName;
  }
  
  // make empty files and tree
  _files = [];
  bucketRoot = {
    name: '',
    key: '',
    type: 'bucket',
    share: `${this.url}`,
    size: 0,
    children: []
  };

  //get bucket URL from current location
  bucketUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}`;  

  // set base URL for the entry file (index.html)
  url = `${this.bucketUrl}${window.location.pathname}`;
  constructor(){
    console.log('currentScript)', document.currentScript);

    // get url from config if present
    if (document.currentScript) { 
      //the idea is to get the configuration straight from the tag script
      //i.e. <script src='http://some.place/build.js' config-var1="foo" config-val2="bar"></script>
    }

    // check querystring to see if this is a shared url
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
    
    // release thre kraken!
    this.getContentes();
  }

  // parse <Contents> element to get file information
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

  // add node to bucket tree
  // the tree builds from the bucketRoot
  addTreeNode(item) {
    var folders = item.key.split("/");
    folders.pop(); // remove file name
    var path = this.bucketRoot;
    while (folders.length !== 0) {
      var folder = folders.shift();
      // eslint-disable-next-line
      var ls = path.children.find( f=> f.name === folder);
      if (!ls) {
        ls = {
          name: folder,
          type: "folder",
          size: 0,
          key: `${path.key}${folder}/`,
          children: []
        };
        ls.share = `${this.url}?shared=${ls.key}`;
        path.children.push(ls);
        path.children.sort(this.sorter);
      }
      ls.size += item.size;
      path = ls;
    }
    
    path.children.push(item);
    path.children.sort(this.sorter);
    this.bucketRoot.size += item.size;
  }

  // helper to get the node value from an element
  getNodeValue(tag, element) {
    return element.getElementsByTagName(tag)[0].childNodes[0].nodeValue;
  }

  // sort function to sort folders first and then files
  sorter(a, b) {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    } else {
      return a.type === "folder" ? -1 : 1;
    }
  }

  // fetch xml data from the bucket
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

  // read the XML and get the Contents (files)
  // fitler the files if this is from a shared link
  getFilesFromXML(data){
    var contents = data.getElementsByTagName("Contents");
    for(let c of contents){
      let file = this.parseContents(c);
      if(!this.shared || file.key.startsWith(this.shared)){
        //add file to list
        this._files.push(file);
        // might be better to sort everthing afterwards?
        this._files.sort(this.sorter);
        //add file as leaf to the tree
        this.addTreeNode(file);
      }
    }
  }

  // remove previous folders up to the shared one
  trimTree(){
    let path = this.shared.replace(/^\/|\/$/g, '').split('/');
    let branch = this.bucketRoot.children;
    while(path.length>0){
      let name = path.shift()
      let item = branch.find(c => c.name === name);
      if(!item) break;
      branch = item.children;
    }
    this.bucketRoot.children = branch;
  }

  //fetch xml the bucket and parse it to get the files
  getContentes() {
    // get the data
    var data = this.fetchBucketData();
    console.log('Data',data);

    //get bucket name
    this.bucketName = this.getNodeValue('Name', data);
    this.bucketRoot.name = this.bucketName;

    // build files from xml
    this.getFilesFromXML(data);

    // get all the chunks, repeat while IsTruncated is true
    // requests after the first one are made using NextMarker node value
    while(this.getNodeValue('IsTruncated', data) === 'true'){
      var marker = this.getNodeValue('NextMarker', data);
      data = this.fetchBucketData(marker);
      this.getFilesFromXML(data);
    };

    // if shared link remove parent folders
    if(this.shared){
      // this could be done so much better 
      this.trimTree();
    }
  }
}