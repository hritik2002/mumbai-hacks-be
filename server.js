import express from "express";
import { extractContent } from "./extractContent.js";
import PromptMeClass from "./PromptMe.js";
import bodyParser from "body-parser";
import crawlWeb from "./crawlWeb.js";
import multer from "multer";
import fs from "fs";
const upload = multer({ dest: "uploads/" });
import path from "path";
import { OPENAI_INPUT_MAX_LENGTH } from "./data.js";

const app = express();
const port = 3001;
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.json({ data: "Healthy" });
});

app.post("/upload", upload.single("path"), (req, res) => {
  try {
    const destinationPath = `./file.pdf`;
    fs.renameSync(req.file.path, destinationPath);

    const fileContent = fs.readFileSync(destinationPath, "utf-8");

    fs.unlinkSync(destinationPath);

    // summary

    res.send(fileContent);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading or saving the file.");
  }
});

app.post("/analyze", async (req, res) => {
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
