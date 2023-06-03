import path from "path";
import { exec } from "child_process";
import fs from 'fs'
import textract from 'textract'

function extractFileContent(filePath, callback) {
  const fileExtension = path.extname(filePath).toLowerCase();

  if (fileExtension === ".pdf") {
    // Extract text from PDF using pdf-poppler
    const outputFilePath = path.join(__dirname, "temp.txt");
    const command = `pdftotext "${filePath}" "${outputFilePath}"`;

    exec(command, (error) => {
      if (error) {
        console.error("Error extracting PDF content:", error);
        callback(error, null);
      } else {
        fs.readFile(outputFilePath, "utf8", (err, data) => {
          if (err) {
            console.error("Error reading extracted text file:", err);
            callback(err, null);
          } else {
            callback(null, data);
          }
          // Delete the temporary text file
          fs.unlink(outputFilePath, (unlinkError) => {
            if (unlinkError) {
              console.error("Error deleting temporary text file:", unlinkError);
            }
          });
        });
      }
    });
  } else if (fileExtension === ".doc" || fileExtension === ".docx") {
    // Extract text from Word document using textract
    textract.fromFileWithPath(filePath, (err, text) => {
      if (err) {
        console.error("Error extracting Word document content:", err);
        callback(err, null);
      } else {
        callback(null, text);
      }
    });
  } else {
    callback(new Error("Unsupported file format"), null);
  }
}

// Usage example
const filePath = "./H405HHL1022670_BHFL In-Principle Sanction Letter.pdf";

export const extractContent = (filePath) => {
  return extractFileContent(filePath, (error, content) => {
    if (error) {
      console.error("Error extracting file content:", error);
      return {
        content: error,
        status: "error",
      };
    } else {
      return {
        content,
        status: "ok",
      };
    }
  });
};
