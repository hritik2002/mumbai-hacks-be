import express from "express";
import { extractContent } from "./extractContent.js";
import PromptMeClass from "./PromptMe.js";
import bodyParser from "body-parser";
import crawlWeb from "./crawlWeb.js";
import multer from "multer";
import fs from "fs";
const upload = multer({ dest: "uploads/" });
import path from 'path'

const app = express();
const port = 3001;
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.json({ data: "Healthy" });
});

app.post("/upload", upload.single("path"), (req, res) => {
  console.log("req.file:", req.file);
  try {
    const destinationPath = `./file.pdf`;
    fs.renameSync(req.file.path, destinationPath);

    const fileContent = fs.readFileSync(destinationPath, "utf-8");
    console.log("fileContent:", fileContent);

    fs.unlinkSync(destinationPath);

    res.send(fileContent);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading or saving the file.");
  }
});

app.post("/analyze", (req, res) => {
  const { urls } = req.body;
  console.log("urls: ", urls);

  let response_data = [];
  //   const urls = [
  //     "https://www.spotify.com/in-en/legal/end-user-agreement",
  //     "https://www.ubuy.co.in/privacy-policy",
  //   ];

  let result = urls;
  urls.map(async (url, index) => {
    crawlWeb(url)
      .then((res) => {
        console.log(res);
        if (res.status === "ok") result[index] = res.extractedText;
      })
      .catch((error) => console.log("error: ", error));
  });

  console.log(result);

  const responseObject = [
    {
      high_risk: {
        title: "High Risk",
        data: ["point1", "point2"],
      },
      medium_risk: {
        title: "med Risk",
        data: ["point1", "point2"],
      },
      low_risk: {
        title: "low Risk",
        data: ["point1", "point2"],
      },
    },
    {
      high_risk: {
        title: "High Risk",
        data: ["point1", "point2"],
      },
      medium_risk: {
        title: "med Risk",
        data: ["point1", "point2"],
      },
      low_risk: {
        title: "low Risk",
        data: ["point1", "point2"],
      },
    },
  ];

  res.json({ data: responseObject });
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
      console.log("result: \n", result);
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
