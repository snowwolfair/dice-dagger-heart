import { Context, $, h } from "koishi";
import {} from "koishi-plugin-puppeteer";
import { Config } from "../config";
import { Property_Dict } from "../utiles/dict";
import fs from "node:fs";
import path from "node:path";

type PuppeteerPage = Awaited<
  ReturnType<NonNullable<Context["puppeteer"]>["page"]>
>;
type PuppeteerElement = Awaited<ReturnType<PuppeteerPage["$"]>>;

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function waitForCaptureReady(page: PuppeteerPage): Promise<void> {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready.catch(() => {});
    }

    const imageTasks = Array.from(document.images, (img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    });

    await Promise.all(imageTasks);
  });
}

export function setBoard(ctx: Context) {
  ctx.command("setboard  设置公告").action(async ({ session }, name) => {
    if (!session) return "无法获取用户信息。";
    if (!ctx.puppeteer) {
      ctx.logger.error("没有开启 puppeteer 服务，无法生成图片。");
      return null;
    }
    return await createImage(ctx, session);
  });
}

function renderPropertyItem(
  key: string,
  value: number | string,
  nameMap?: Record<string, string>,
): string {
  // 优先使用映射后的中文名，如果没有则回退到英文 key
  const name = nameMap[key] || key;

  return `<div class="box small-box">
          <div class="box-inner-label">${name}</div>
          <div class="box-inner-value">${value}</div>
        </div>`;
}

function renderExperienceItem(key: string, value: any): string {
  return `<div class="exp-row">
          <div class="line">${key}</div>
          <div class="square-check">${value}</div>
        </div>`;
}

async function createImage(
  ctx: Context,
  session: any,
): Promise<ReturnType<typeof h.image> | null> {
  let page: PuppeteerPage | null = null;
  let captureRoot: PuppeteerElement | null = null;
  let shouldClosePage = true;

  const templatePath = path.resolve(__dirname, "../../data/ttt.html");
  try {
    page = await ctx.puppeteer.page();
    console.log(page);
    const characterInfo = await ctx.database
      .select("playercharacter")
      .where((row) => $.eq(row.userid, session.event.user.id))
      .where((row) => $.eq(row.groupid, session.guildId))
      .where((row) => $.eq(row.useable, true))
      .execute();

    if (characterInfo.length === 0) {
      ctx.logger.warn(`群组 ${session.guildId} 没有人物卡数据，无法渲染。`);
      return null;
    }

    console.log(session.event.user, session.user);
    const user = session.event.user;
    const groupId = session.guildId;

    const templateHtml = await fs.promises.readFile(templatePath, "utf-8");
    console.log(templateHtml);

    console.log(characterInfo[0]);

    const Dict_Reverse = Object.fromEntries(
      Object.entries(Property_Dict).map(([cn, en]) => [en, cn]),
    );

    const userInfoHtml = `<div class="avatar"><img src="${escHtml(user.avatar || "")}" alt="头像" class="avatar-image" /></div>
        <div class="name-input">${user.name}</div>`;
    const damageMajor = `<div class="damage-box number-box">${characterInfo[0].major ?? 0}</div>`;
    const damageSevere = `<div class="damage-box number-box">${characterInfo[0].severe ?? 0}</div>`;

    const hpHtml = renderPointItem(characterInfo[0].hp, true);
    const hopeHtml = renderPointItem(characterInfo[0].hope, false);
    console.log(hopeHtml);
    const stressHtml = renderPointItem(characterInfo[0].stress, false);

    // const experienceHtml = renderPointItem(characterInfo[0].experience, false);

    const experienceArray = JSON.parse(characterInfo[0].experience);
    const experienceObject = experienceArray.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    let experienceHtml = "";
    if (Object.entries(experienceObject).length === 0) {
      experienceHtml = `<div class="exp-row">
          <div class="line"></div>
          <div class="square-check"></div>
        </div>`;
    } else {
      experienceHtml = Object.entries(experienceObject)
        .map(([key, value]) => renderExperienceItem(key, value))
        .join("\n");
    }

    console.log(experienceHtml);
    const propertyItemsHtml = Object.entries(characterInfo[0].property)
      .map(([key, value]) => renderPropertyItem(key, value, Dict_Reverse))
      .join("\n");

    const finalHtml = templateHtml
      .replace("{{CHARACTER_NAME}}", userInfoHtml)
      .replace("{{PROPERTY_ITEMS}}", propertyItemsHtml)
      .replace("{{DAMAGE_MAJOR}}", damageMajor)
      .replace("{{DAMAGE_SEVERE}}", damageSevere)
      .replace("{{HP}}", hpHtml)
      .replace("{{HOPE}}", hopeHtml)
      .replace("{{STRESS}}", stressHtml)
      .replace("{{EXPERIENCE}}", experienceHtml);

    // .replace('{{STATUS}}', status)
    // .replace('{{EXPERIENCE}}', proCon)

    // characterInfo
    await page.setContent(finalHtml, { waitUntil: "domcontentloaded" });
    await waitForCaptureReady(page);

    captureRoot = await page.$("#card");

    if (!captureRoot) {
      ctx.logger.error("无法获取截图根节点。");
      shouldClosePage = true;
      return null;
    }

    const image = await captureRoot.screenshot({
      quality: 100,
      type: "jpeg",
    });
    return h.image(image, "image/jpeg");

    // session.send(`<html>${user.name}</html>`);
  } catch (error) {
    ctx.logger.error(`设置公告失败：${error}`);
    return null;
  } finally {
    if (captureRoot) {
      ctx.logger.info("关闭截图根节点");
      await captureRoot.dispose().catch(() => {});
    }
    if (page && shouldClosePage) {
      ctx.logger.info("关闭页面");
      await page.close().catch(() => {});
    }
  }
}

function renderPointItem(item: any, reverse = false): string {
  let html: string[] = [];

  // 根据 reverse 参数决定先渲染哪一种 span
  const firstCount = reverse ? item.max - item.value : item.value;
  const secondCount = reverse ? item.value : item.max - item.value;

  // 先渲染第一部分
  for (let i = 0; i < firstCount; i++) {
    html.push(`<span class="checkbox-checked"></span>`);
  }

  // 再渲染第二部分
  for (let i = 0; i < secondCount; i++) {
    html.push(`<span class="checkbox"></span>`);
  }

  return html.join("\n");
}
