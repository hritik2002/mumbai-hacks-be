import express from "express";
import PromptMeClass from "./PromptMe.js";
import bodyParser from "body-parser";
import crawlWeb from "./crawlWeb.js";
import multer from "multer";
import fs from "fs";
import pdfjs from "pdfjs-dist"
import mammoth from "mammoth"
const upload = multer({ dest: "uploads/" });
import path from "path";
import { OPENAI_INPUT_MAX_LENGTH } from "./data.js";
import { type } from "os";

const app = express();
const port = 3001;
app.use(bodyParser.json());
// app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Replace with your client's URL
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});


app.get("/", (req, res) => {
  res.json({ data: "Healthy" });
});

const promptArr = [
  "In the above agreement give me the result of parties involved in the following json format for party type and party name, the result should be JSON only",
  "Give me the number of risks, the gravity of risks, number of advantages and gravity of advantages for in the following format for [__ELEMENTS__] in the given data to create a single JSON where [__ELEMENTS__] are object keys of the unified JSON in the one single object response"
];

const stringifyJsonprompt = JSON.stringify({"parties_in_doc":{"party1":{"name":"{{party1name}}","type":"{{party1type}}"},"party2":{"name":"{{party2name}}","type":"{{party2type}}"},"partyN":{"name":"{{partyNname}}","type":"{{partyNtype}}"}}});
promptArr[0] += stringifyJsonprompt;

const promptJson =  {
    "numberOfRisks": "X number of risks of  ",
		"gravityOfRisks": "high | medium | low",
		"risks": {
			"riskX": "details of risk of __ELEMENT__ in the string",
		},
		"numberOfAdvantages": "Y number of advantage __ELEMENT__",
		"gravityOfAdvantages": "high | medium | low",
		"Advantages": {
			"AdvantageY": "details of Advantage of __ELEMENT__ in the string"
		}
}

app.post("/upload", upload.single("file"), async(req, res) => {
  try {
    const bodyContent = req.body.content;
   
    if (!req.file && !bodyContent) {
      return res.status(400).send('No file uploaded.');
    }

    let filePath;
    let fileExtension;

    if(req.file){
       filePath = req.file.path;
       fileExtension = path.extname(req.file.originalname).toLowerCase();
    }
    console.log("fileExtension", fileExtension);
    let fileContent = "";
    if(fileExtension === ".pdf"){
      fileContent = await readPDF(filePath);
    console.log("fileContent pdf", fileContent);

    }else if(fileExtension === ".docx" || fileExtension === ".doc"){
      fileContent = await readDocFile(filePath);
      console.log("docx file content",fileContent);
      
    }else if(typeof bodyContent === "string"){
      fileContent = bodyContent;
    }
   
    const data = await getAIData(fileContent)

    const uniqueKey = generateUniqueKey();

    if(data && uniqueKey && fileContent){
      if (fileContent.length >= OPENAI_INPUT_MAX_LENGTH) {
        let numberOfSplits = (fileContent.length - 900) / OPENAI_INPUT_MAX_LENGTH;
        fileContent = await getNewSummariseData(
          fileContent,
          "\n\nSummarize in " +
            ((data.length) / numberOfSplits - numberOfSplits) +
            " characters"
        );
      }
      getAIData(fileContent, promptArr[0], uniqueKey, 1);
    }

    // if(filePath){
    //   await fs.unlink(filePath);
    // }
    
    return res.send({"data": data, "uniqueKey" : uniqueKey, idx:0});


  } catch (err) {
    console.error("error printing....",err);
    return res.status(500).send("Error reading or saving the file.");
  }
});

app.post("/polling", async(req,res) => {

  const { key, idx } = req.body;
  const filename = `${key}--${idx}.txt`;

  const filePath = "results/" + filename;
  console.log(filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.send({status : "processing" ,  uniqueKey : key, idx});
    }
  });

  // return
  fs.readFile(filePath, 'utf8', (error, data) => {
    if (error) {
      console.error('Error reading file:', error);
      return res.status(200).send({status:"processing", uniqueKey : key, idx});
    }

    if(!data){
      res.status(500).send("Oops! Something went wrong. Please check the file again.");
    }

    try{
      const jsonData = JSON.parse(data);
      let favourableData = "";
      if(idx === 2){
        favourableData = getFavourableData(jsonData);
      }

      return res.send({data : jsonData ,  uniqueKey : key, idx, status : "complete", favourableData});
    }catch{
      return res.send({data : data ,  uniqueKey : key, idx, status : "complete", favourableData : ""});
    }
  });

});

const getFavourableData = (data) => {
  const favorableObj={};
  for (const key in data) {
   
    if (data.hasOwnProperty(key)) {
      const obj = data[key];
      const numberOfRisks = parseInt(obj.numberOfRisks.split(' ')[0]);
      const numberOfAdvantages = parseInt(obj.numberOfAdvantages.split(' ')[0]);
      favorableObj[key] = numberOfAdvantages - numberOfRisks
    }
  }
  let maxKey = null;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (const key in favorableObj) {
    if (favorableObj.hasOwnProperty(key)) {
      const value = favorableObj[key];
      if (value > maxValue) {
        maxValue = value;
        maxKey = key;
      }
    }
  }

  return maxKey;
}

const getAIData = async(content, prompt="", uniqueKey, idx) => {
  console.log("prompt", prompt)
    if(!prompt){
      prompt = "/n/ntl;dr";
    }
    const promptClass = new PromptMeClass(content);
    const data = await promptClass.PromptMe(prompt);
    console.log("idx", idx);
    console.log("uniqueKey", uniqueKey);

    if(uniqueKey && idx){
      if(idx === 1){
        console.log("indx 1 data", data);
        await saveFile(uniqueKey, idx, data);
        const partyArr = [];
        const partiesInDoc = typeof data === "string" ? JSON.parse(data) : data;

        for (const key in partiesInDoc["parties_in_doc"]) {
          if (partiesInDoc["parties_in_doc"].hasOwnProperty(key)) {
            const type = partiesInDoc["parties_in_doc"][key].type;
            
            partyArr.push(type);
          }
        }

        const uniqueValues = [...new Set(partyArr)];
        console.log("uniqueValues", uniqueValues)

        const arrayElement = formatArrayElements(uniqueValues);
        let prompt = promptArr[1].replace("__ELEMENTS__", arrayElement);
        let outputPromptJsonObj = getUpdatedPromptJson(uniqueValues);
        prompt += "\n";
        prompt += JSON.stringify(outputPromptJsonObj);
        
        await getAIData(content, prompt, uniqueKey, idx+1)
      }else{
        console.log("data 2", data);
        await saveFile(uniqueKey, idx, data);
      }
    }

    console.log("data123", data)
    return data;
}

const getNewSummariseData = async(content, prompt) => {
  const promptClass = new PromptMeClass(content);
  const data = await promptClass.PromptMe(prompt);
  return data
}

function formatArrayElements(array) {
  const output = array.join(', ').replace(/,([^,]*)$/, ' and$1');
  return output;
}

const getUpdatedPromptJson = (element) => {
  const obj = {};
  // // console.log(element);
  // for(const e of element){
  //     obj[e] = replaceElement(promptJson,e);
  //     console.log("promptJson",obj[e]);
  // }
  // return obj;
  const replaceWith = element.join('/');
  const updatedJson = replaceElement(promptJson, replaceWith);
  obj[replaceWith] = updatedJson;
  return obj;
}

function replaceElement(obj, replaceWith) {
  for (let key in obj) {
    if (typeof obj[key] === 'object') {
      replaceElement(obj[key], replaceWith);
    } else if (typeof obj[key] === 'string' && obj[key].includes('__ELEMENT__')) {
      obj[key] = obj[key].replace('__ELEMENT__', replaceWith);
    }
  }
  console.log("obj data replace element", obj);
  return obj;
}



const saveFile = (key, idx, data) => {
  const fileName = `${key}--${idx}.txt`;
  const filePath = "results/" + fileName

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (error) => {
      if (error) {
        reject(error);
      } else {
        console.log("sucess")
        resolve();
      }
    });
  });
}

const readPDF = async(filename) => {
  const data = new Uint8Array(fs.readFileSync(filename));
  const doc = await pdfjs.getDocument(data).promise;
  const numPages = doc.numPages;
  
  let text = '';
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    text += pageText + ' ';
  }
  
  return text;
}

const readDocFile = async(filename) => {
  return new Promise((resolve, reject) => {
    const options = {
      convertImage: mammoth.images.imgElement(function (element) {
        return element.read('base64');
      }),
    };

    mammoth.extractRawText({ path: filename }, options)
      .then(result => {
        const content = result.value.trim(); // Trim extra whitespace
        resolve(content);
      })
      .catch(error => {
        reject(error);
      });
  });

}

const generateUniqueKey = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters[randomIndex];
  }
  
  return key;
}




app.post("/analyze", async(req, res) => {
  const { urls } = req.body;

  let website_content = [],
    website_summarized_content = [];
  website_content = await Promise.all(
    urls.map(async (url, index) => {
      const res = await crawlWeb(url);
      if (res.status === "ok") return res.extractedText;
      else return "";
    })
  );

  website_summarized_content = await Promise.all(
    website_content.map(async (content, index) => {
      let promptMeObj = new PromptMeClass(content);
      if (content.length <= OPENAI_INPUT_MAX_LENGTH) {
        return await promptMeObj.PromptMe("\n\nTl;dr");
      } else {
        let numberOfSplits = content.length / OPENAI_INPUT_MAX_LENGTH;
        return await promptMeObj.PromptMe(
          "\n\nSummarize in " +
            (OPENAI_INPUT_MAX_LENGTH / numberOfSplits - numberOfSplits) +
            " characters"
        );
      }
    })
  );

  const responseData = await Promise.all(
    website_summarized_content.map(async (summary) => {
      let responseObject = {
        high_risk: {
          title: "High Risk",
          data: [],
          description: [],
        },
        medium_risk: {
          title: "med Risk",
          data: [],
          description: [],
        },
        low_risk: {
          title: "low Risk",
          data: [],
          description: [],
        },
      };
      if (summary.trim().length < 5) {
        return responseObject;
      } else {
        let promptMeObj = new PromptMeClass(summary);
        let sentences =
          await promptMeObj.PromptMe(`\n\nIdentify the key clauses which the user is agreeing to while signing up on this website.
        Classify each clause in the type of the clause it is, and the risk involved in agreeing to the terms against the type of the clause.
        Give the response for all clauses in the following structure.
        "Clause Name : Clause TL;DR & involves High/Medium/Low risk"`);

        sentences = sentences.split("\n");

        sentences.map((sentence) => {
          if (sentence.trim().length) {
            let arr = sentence.split(": ");
            if (!arr[0] || !arr[1]) return;

            if (arr[1].toLowerCase().includes("high")) {
              if (isNaN(arr[0].trim()[0]))
                responseObject["high_risk"]["data"].push(arr[0]);
              else responseObject["high_risk"]["data"].push(arr[0].substr(3));
              responseObject["high_risk"]["description"].push(arr[1]);
            } else if (arr[1].toLowerCase().includes("medium")) {
              if (isNaN(arr[0].trim()[0]))
                responseObject["medium_risk"]["data"].push(arr[0]);
              else responseObject["medium_risk"]["data"].push(arr[0].substr(3));
              responseObject["medium_risk"]["description"].push(arr[1]);
            } else if (arr[1].toLowerCase().includes("low")) {
              if (isNaN(arr[0].trim()[0]))
                responseObject["low_risk"]["data"].push(arr[0]);
              else responseObject["low_risk"]["data"].push(arr[0].substr(3));
              responseObject["low_risk"]["description"].push(arr[1]);
            }
          }
        });

        return responseObject;
      }
    })
  );

  res.json({ data: responseData });
});

app.post("/promptMe", (req, res) => {
  const { prompt, content } = req.body;

  if (!prompt || !content)
    return res.json({
      status: "please add all the fields",
    });

  // Perform content extraction logic here
  //   const responseObject = extractContent(filePath);
  //   if (responseObject.status === "ok") {
  // const promptMeObj = new PromptMeClass(content);

  const promptMeObj = new PromptMeClass(content);
  return promptMeObj
    .PromptMe(prompt)
    .then((result) => {
      return res.json({ result, status: "ok" });
    })
    .catch((error) => {
      console.error("Error:", error);
      return res.json({
        error,
        status: "error",
      });
    });
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
