import "./css/style.css";
import { SorReader } from "./js/sor";
import { Gui } from "./js/gui";

//echarts
let externalScript = document.createElement("script");
externalScript.setAttribute(
  "src",
  "https://cdnjs.cloudflare.com/ajax/libs/echarts/4.6.0/echarts-en.common.min.js"
);
document.head.appendChild(externalScript);

const config = {
  browserMode: true,
};
const UserInterface = new Gui();
const fileInput = document.getElementById("fileinput") as HTMLInputElement;
const fileList = document.getElementById("fileList");

function loadFile(file: File) {
  if (!checkBrowserCompatibility()) {
    return;
  }

  UserInterface.clearDivs();
  const reader = new FileReader();

  reader.onload = (res) => {
    if (res != null) {
      let result = res.target!.result;
      parseFile(result);
    }
  };

  reader.onerror = (err) => {
    console.error(err);
    flashMessage("Error reading file", "Alert");
  };
  
  reader.readAsArrayBuffer(file);
}

fileInput?.addEventListener("change", function handleFileSelect() {
  if (!fileInput.files?.length) {
    return;
  }

  // Clear the file list
  if (fileList) {
    fileList.innerHTML = "";
  }

  // Add each file to the list
  Array.from(fileInput.files).forEach((file) => {
    if (!file.name.toLowerCase().endsWith('.sor')) {
      return;
    }

    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `<span class="file-item-name">${file.name}</span>`;
    
    fileItem.addEventListener("click", () => {
      // Remove selected class from all items
      document.querySelectorAll(".file-item").forEach(item => {
        item.classList.remove("selected");
      });
      
      // Add selected class to clicked item
      fileItem.classList.add("selected");
      loadFile(file);
    });

    fileList?.appendChild(fileItem);
  });
});

function parseFile(result: any): void {
  let sor = new SorReader(undefined, config, result);
  let data = sor.parse();
  data.then((result) => {
    console.log(result);
    UserInterface.showResults(result);
  });
}

function checkBrowserCompatibility() {
  if (typeof window.FileReader !== "function") {
    flashMessage("The file API isn't supported on this browser yet.");
    return false;
  }
  if (!fileInput) {
    flashMessage("Couldn't find the fileinput element.");
    return false;
  } else if (!fileInput.files) {
    flashMessage(
      "This browser doesn't seem to support the `files` property of file inputs."
    );
    return false;
  }
  return true;
}

function flashMessage(message: string, type: string = "Alert") {
  const parentMessageDiv = document.getElementById("flashMessage");
  parentMessageDiv!.style.display = "block";
  if (type) {
    parentMessageDiv!.classList.add("message" + type);
  }
  const messageDiv = document.getElementById("message");
  messageDiv!.innerHTML = message;
}
