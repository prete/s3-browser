import React from "react";
import "antd/dist/antd.css";
import Bucket from "./Bucket"
import { message, Modal, Table, Tag, Button, Icon, Input, Tooltip} from "antd";
import moment from "moment";

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tree: [],
      files: [],
      results: []
    };
  }

  componentDidMount() {
    let bucket = new Bucket('https://cellgeni.cog.sanger.ac.uk');

    this.setState({
      searching: false,
      tree: bucket.tree,
      files: bucket.files,
      results: bucket.tree
    });
  }

  // src: https://stackoverflow.com/questions/20459630/javascript-human-readable-filesize
  readableFileSize(size) {
    if (size === 0) return "0.00 B";
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (
      (size / Math.pow(1024, i)).toFixed(2) * 1 +
      " " +
      ["B", "kB", "MB", "GB", "TB"][i]
    );
  }

  onRowClick = (record, index, event) => {
    //console.log("Row click", { record: record, index: index, event: event });
    console.log("Row click", record);
  };

  onRowDoubleClick = (record, index, event) => {
    console.log("Row double click", {
      record: record,
      index: index,
      event: event
    });
  };

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
        let download = <Button icon="download" shape="round" onClick={this.handleDownload.bind(null, record)}/>;
        return (
          <Button.Group size="small">
            <Button icon="link" shape="round" onClick={this.handleShare.bind(null, record)}/>
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
      },
      onCell: (record, index) => ({
        onClick(e) {
          console.log("Click cell", ` row ${index}`, record, e.target);
        }
      })
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

  handleShare(record, event){
    
    function copyShareableLink(event){
      message.destroy();
      event.target.select();
      document.execCommand("copy");
      message.success('Link copied!');
    }

    Modal.info({
      title: `Share this ${record.type} with others`,
      content: (
        <div>
          <span>Copy the following link:</span>
          <Input id="shareable-link" addonAfter={<Icon type="link" />} value={record.share} onClick={copyShareableLink} readOnly/>
        </div>
      ),
      onOk() {
        console.log('OK');
      }
    });
    
    event.stopPropagation();
  }

  handleDownload(record, event){
    console.log(record);
    window.open(record.url);
    event.preventDefault();
  }

  queryResult = [];

  async handleSearch(event) {
    var searchResults = [];
    var term = event.target.value.toLowerCase();
    if (term && term.length >= 3) {
      this.setState( state => ({searching:true}));
      searchResults = this.state.files.filter(f =>
        f.name.toLowerCase().includes(term)
      );
    } else {
      this.setState( state => ({searching:false}));
      searchResults = this.state.tree;
    }
    this.setState(state => ({ results: searchResults }));
  }

  //footer = () => <span>{this.state.files.length} file(s)</span>;

  render() {
    return (
      <div>
        <Tooltip title="Search for file. Input at least 3 characaters.">
          <Input
            prefix={<Icon type="file-search" />}
            placeholder="Search..."
            onChange={this.handleSearch.bind(this)}
          />
        </Tooltip>
        <Table
          size="medium"
          pagination={false}
          expandIcon={this.folderExpandIcon.bind(this)}
          columns={this.columns}
          dataSource={this.state.results}
          //footer={this.footer}
          onRow={(record, index) => ({
            onClick: this.onRowClick.bind(null, record, index),
            onDoubleClick: this.onRowDoubleClick.bind(null, record, index)
          })}
          expandRowByClick
        />
      </div>
    );
  }
}

export default App;
