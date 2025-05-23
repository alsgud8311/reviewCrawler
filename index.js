import { Builder, By, Browser, WebDriver, Key } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { subjects } from "./subjects.js";
import { Parser } from "json2csv";
import fs from "fs";

/**
 * @typedef {object} LectureDetail
 * @property {string} lectureName
 * @property {string} professor
 * @property {string} link
 */

/**
 * @typedef {object} LectureReview
 * @property {string} lectureName
 * @property {string} professor
 * @property {string} link
 * @property {string} review
 */
// User-Agent 문자열 (원하는 UA로 수정 가능)
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

// Firefox 옵션 설정

(async function main() {
  // Chrome 막힘 -> Firefox 사용
  const options = new firefox.Options();
  options.setPreference("general.useragent.override", USER_AGENT);

  const driver = await new Builder().forBrowser(Browser.SAFARI).build();

  try {
    everytimeLogin(driver, "아이디", "비밀번호");
    await driver.sleep(3000);

    const lectures = await getLectureDetails(driver, subjects);
    console.log(lectures);

    const lectureInfo = await getLectureReviews(driver, lectures);

    saveAsCSV(lectureInfo, "everytime.csv");
    await driver.sleep(3000);
  } finally {
    await driver.quit();
  }
})();

/**
 *
 * @param {string} subject
 * @returns {string}
 */
const getSearchSubjectUrl = (subject) =>
  `https://everytime.kr/lecture/search?keyword=${subject}&condition=name`;

/**
 *
 * @param {WebDriver} driver
 * @param {string} id
 * @param {string} password
 */
const everytimeLogin = async (driver, id, password) => {
  await driver.get("https://account.everytime.kr/login");

  await driver.findElement(By.name("id")).sendKeys(id);
  await driver.findElement(By.name("password")).sendKeys(password);

  await driver.findElement(By.xpath("//*[@type='submit']")).click();
};

/**
 *
 * @param {WebDriver} driver
 * @param {string[]} subjects
 * @returns {Promise<LectureDetail[]>}
 * @description
 * 1. 매개변수로 받은 과목 목록을 순회하며 각 과목에 대한 강의 정보를 가져옴
 * 2. 각 과목에 대해 검색 URL로 이동하고, 페이지가 로드될 때까지 대기
 * 3. 강의 목록을 가져와서 각 강의에 대한 정보를 추출
 * 4. 강의 정보는 과목명, 교수명, 링크로 구성된 객체로 만들어 lectures 배열에 추가
 * 5. 모든 과목에 대한 강의 정보를 가져온 후 lectures 배열을 반환
 */
const getLectureDetails = async (driver, subjects) => {
  const lectures = [];
  for (const subject of subjects) {
    await driver.get(getSearchSubjectUrl(subject));

    await driver.sleep(3000);

    const lectureElements = await driver.findElements(By.className("lecture"));
    for (
      let lectureIdx = 0;
      lectureIdx < lectureElements.length;
      lectureIdx++
    ) {
      const lectureElement = lectureElements[lectureIdx];
      const lectureName = await lectureElement
        .findElement(By.className("name"))
        .getText();
      let professor = await lectureElement.findElements(
        By.className("professor")
      );
      if (professor.length) {
        professor = await professor[0].getText();
      }

      const link = await lectureElement.getAttribute("href");
      lectures.push({
        lectureName,
        professor: typeof professor === "object" ? "미배정" : professor,
        link,
      });
    }
  }
  return lectures;
};
/**
 * @param {WebDriver} driver
 * @param {LectureDetail[]} lectureDetails
 * @returns {Promise<LectureReview[]>}
 */
const getLectureReviews = async (driver, lectureDetails) => {
  const lectures = [];

  for (const lecture of lectureDetails) {
    const lectureReviewUrl = `${lecture.link}?tab=article`;
    await driver.get(lectureReviewUrl);
    await driver.sleep(2000);

    for (let i = 0; i < 10; i++) {
      await driver.executeScript(
        `document.querySelector(".articles").scrollTo(0, 10000);`
      );
      await driver.sleep(1000);
    }

    const reviewElements = await driver.findElement(By.className("articles"));
    const reviews = await reviewElements.findElements(By.className("article"));

    for (const element of reviews) {
      try {
        const review = await element
          .findElement(By.className("text"))
          .getText();
        lectures.push({ ...lecture, review });
      } catch (err) {
        console.warn("❌ 리뷰 추출 실패함:", err.message);
      }
    }
  }

  return lectures;
};

/**
 * @param {LectureReview[]} data
 * @param {string} fileName
 */
const saveAsCSV = (data, fileName) => {
  try {
    const fields = ["lectureName", "professor", "link", "review"];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    fs.writeFileSync(fileName, csv, "utf8");
    console.log(`✅ CSV 저장 완료: ${fileName}`);
  } catch (err) {
    console.error("❌ CSV 저장 실패:", err);
  }
};
