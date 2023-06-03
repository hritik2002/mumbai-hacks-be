import cheerio from "cheerio";
import axios from "axios";

export default async function crawlWeb(url) {
  // working urls
  // https://www.spotify.com/in-en/legal/end-user-agreement/
  // https://www.ubuy.co.in/privacy-policy

  const extractedText = [];

  return await axios
    .get(url)
    .then((response) => {
      const html = response.data;
      const $ = cheerio.load(html);

      $("p").each((index, element) => {
        const text = $(element).text().trim();
        extractedText.push(text);
      });
      let website_content = "";

      extractedText.forEach((text) => {
        // console.log(text);
        website_content += text + " ";
      });

      return { extractedText: website_content, status: "ok" };
      // Further code for extracting text goes here
    })
    .catch((error) => {
      // console.log("Error:", error);
      return {
        error,
        status: "error",
      };
    });
}

// crawlWeb("https://www.ubuy.co.in/privacy-policy").then((res) =>
//   console.log(res)
// );

// const urls = [
//   "https://www.spotify.com/in-en/legal/end-user-agreement",
//   "https://www.ubuy.co.in/privacy-policy",
// ];

// let result = urls;
// urls.map(async (url, index) => {
//   crawlWeb(url)
//     .then((res) => {
//       console.log(res);
//       if (res.status === "ok") result[index] = res.extractedText;
//     })
//     .catch((error) => console.log("error: ", error));
// });

// console.log(result);
