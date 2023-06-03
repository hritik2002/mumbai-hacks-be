import { OPENAI_INPUT_MAX_LENGTH } from "./data.js";
export default class PromptMeClass {
  /**
   * Summarizer class that uses OpenAI API to generate summaries
   */
  constructor(content) {
    this.content = this.replaceNonAlphanumeric(content);
    this.maxTokens = 512;
    this.maxLen = OPENAI_INPUT_MAX_LENGTH;
    this.apiKey = "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";
    this.model = "text-davinci-003";
  }

  replaceNonAlphanumeric(string) {
    // Use regex to replace all non-alphanumeric characters with an empty space
    return string.replace(/[^a-zA-Z0-9]/g, " ");
  }

  async PromptMe(promptCommand) {
    // Split text into chunks that are within the token limit
    const chunks = this.splitText(this.content);
    let summary = "";

    // Generate result for each chunk of text
    for (const chunk of chunks) {
      const prompt = `${chunk} ${promptCommand}`;

      const payload = {
        prompt,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: this.maxTokens,
        stream: false,
        n: 1,
        model: this.model,
      };

      // Call OpenAI API.
      return fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.apiKey,
        },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => (summary += data.choices[0].text.trim()))
        .catch((error) => {
          // console.log(error.message, error);
          return "";
        });
    }

    return summary;
  }

  splitText(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += this.maxLen) {
      chunks.push(text.slice(i, i + this.maxLen));
    }
    return chunks;
  }
}

// Usage example
const content = `
12.13. Marketing. CleverTap may use Customer’s name and logo on CleverTap’s website and other marketing materials solely to identify Customer as a Customer of CleverTap (without revealing any Confidential Information).
`;

// const promptMeObj = new PromptMeClass(content);

// promptMeObj
//   .PromptMe(
//     `\ntl;dr.`
//   )
//   .then((result) => {
//     console.log("result: \n", result);
//   })
//   .catch((error) => {
//     console.error("Error:", error);
//   });
