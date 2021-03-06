const querystring = require("qs");
const fetch = require("node-fetch");
const Db = require("./db");

require("dotenv").config();

class Bitrix {
  constructor() {
    // const supportGroup = ["1819", "1600", "3", "1480", "1588"];
    // const supportGroup = ["1819"];
    this.supportUsers = Db.getSupportUsers();
    if (!this.supportUsers) {
      this.supportUsers = ["1819"];
      Db.addSupportUser("1819");
    }
    this.configs = Db.getConfigs();
  }

  getSupportUsers = () => {
    if (this.supportUsers) {
      return this.supportUsers;
    } else {
      //TODO send message about getSupportUsers error
      return ["1819"];
    }
  };

  addSupportUser = userIdStr => {
    const result = Db.addSupportUser(userIdStr);
    if (result) {
      //TODO send message with new support users
      this.supportUsers = result;
    } else {
      //TODO send message about addSupportUser error
    }
  };

  deleteSupportUser = userIdStr => {
    const result = Db.deleteSupportUser(userIdStr);
    if (result) {
      this.supportUsers = result;
      //TODO send message with new support users
    } else {
      //TODO send message about addSupportUser error
    }
  };

  sendMessage = async (userId, msg, auth, attach = []) => {
    const result = await this.restCommand(
      "imbot.message.add",
      {
        DIALOG_ID: userId,
        MESSAGE: msg,
        ATTACH: attach
      },
      auth
    );
    if (result) {
      console.log("Sending message result: ", result);
    } else {
      console.log("Sending message error");
    }
  };

  getFileUrl = async (fileId, auth) => {
    const result = await this.restCommand(
      "disk.file.get",
      {
        id: fileId
      },
      auth
    );
    return result["result"]["DOWNLOAD_URL"];
  };

  /**
   * @param filesObj
   * @param folderId
   * @param auth
   * @returns {Promise<boolean|[]>}
   */
  saveFiles = async (filesObj, folderId, auth) => {

    const MAX_SAVE_TRIAL = 200;
    const SAVE_CHECK_DELAY_MS = 3000;

    let isError = false;

    let count = 0;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    let filesObjectsArr = [];

    for(const key of Object.keys(filesObj)) {
      let isFullFile = false;
      while(!isFullFile) {
        //File do not uploaded yet
        console.log(`File ${filesObj[key]["name"]} do not uploaded yet`);
        if(count > MAX_SAVE_TRIAL) {
          isError = true;
          return false;
        }
        count++;
        await sleep(SAVE_CHECK_DELAY_MS);
        isFullFile = await this.isFileUploaded(filesObj[key]["id"], auth);
      }
      //File uploaded
      console.log(`File ${filesObj[key]["name"]} uploaded`);
      filesObjectsArr.push(filesObj[key]);
    }

    if(isError)
      return false;

    let copiedFilesInfoArr = [];

    for(const fileObj of filesObjectsArr) {
      const fileInfo = await this.copyFile(fileObj["id"], folderId, auth);
      if(!fileInfo)
        isError = true;
      copiedFilesInfoArr.push(fileInfo);
    }

    if(isError)
      return false;

    return copiedFilesInfoArr;
  };

  //return
  // {
  //   "ID": "10", //идентификатор
  //   "NAME": "2511.jpg", //название файла
  //   "CODE": null, //символьный код
  //   "STORAGE_ID": "4", //идентификатор хранилища
  //   "TYPE": "file",
  //   "PARENT_ID": "8", //идентификатор родительской папки
  //   "DELETED_TYPE": "0", //маркер удаления
  //   "CREATE_TIME": "2015-04-24T10:41:51+03:00", //время создания
  //   "UPDATE_TIME": "2015-04-24T15:52:43+03:00", //время изменения
  //   "DELETE_TIME": null, //время перемещения в корзину
  //   "CREATED_BY": "1", //идентификатор пользователя, который создал файл
  //   "UPDATED_BY": "1", //идентификатор пользователя, который изменил файл
  //   "DELETED_BY": "0", //идентификатор пользователя, который переместил в корзину файл
  //   "DOWNLOAD_URL": "https://test.bitrix24.ru/disk/downloadFile/10/?&ncc=1&filename=2511.jpg&auth=******",
  // //возвращает url для скачивания файла приложением
  //   "DETAIL_URL": "https://test.bitrix24.ru/workgroups/group/3/disk/file/2511.jpg"
  // //ссылка на страницу детальной информации о файле
  // }
  copyFile = async (fileId, desFolderId, auth) => {
    const result = await this.restCommand(
        "disk.file.copyto",
        {
          id: fileId,
          targetFolderId: desFolderId,
        },
        auth
    );
    if("result" in result) {
      return result["result"];
    } else {
      return false;
    }
  };

  isFileUploaded = async (fileId, auth) => {
    const result = await this.restCommand(
        "disk.file.getVersions",
        {
          id: fileId
        },
        auth
    );
    if("result" in result) {
      return result["result"].some((fileObj) => fileObj["GLOBAL_CONTENT_VERSION"] > 1);
    } else {
      console.log("disk.file.getVersions ERROR: ", result);
      return false;
    }
  };

  registerBotAndCommands = async (token, auth) => {
    let result = await this.restCommand(
      "imbot.register",
      {
        CODE: "Вопросы производству",
        TYPE: "H",
        EVENT_MESSAGE_ADD: process.env.SERVER_HOST,
        EVENT_WELCOME_MESSAGE: process.env.SERVER_HOST,
        EVENT_BOT_DELETE: process.env.SERVER_HOST,
        PROPERTIES: {
          NAME: "Вопросы производству",
          COLOR: "GREEN",
          EMAIL: "evg.hrn@gmail.com",
          PERSONAL_BIRTHDAY: "2020-02-26",
          WORK_POSITION: "Вопросы производству",
          PERSONAL_WWW: "http://bitrix24.com",
          PERSONAL_GENDER: "M"
          // "PERSONAL_PHOTO": avatar,
        }
      },
      auth
    );
    const botId = result["result"];
    result = await this.restCommand(
      "imbot.command.register",
      {
        BOT_ID: botId,
        COMMAND: "masssend",
        COMMON: "N",
        HIDDEN: "N",
        EXTRANET_SUPPORT: "N",
        LANG: [
          {
            LANGUAGE_ID: "ru",
            TITLE:
              "Рассылка подразделению. Нельзя использовать тире в сообщении и названии подразделения",
            PARAMS: "Подразделение-Сообщение"
          }
        ],
        EVENT_COMMAND_ADD: process.env.SERVER_HOST
      },
      auth
    );
    const commandMassSend = result["result"];

    result = await this.restCommand(
      "imbot.command.register",
      {
        BOT_ID: botId,
        COMMAND: "addsupportuser",
        COMMON: "N",
        HIDDEN: "N",
        EXTRANET_SUPPORT: "N",
        LANG: [
          {
            LANGUAGE_ID: "ru",
            TITLE: "Добавить пользователя в группу поддержки",
            PARAMS: "id пользователя"
          }
        ],
        EVENT_COMMAND_ADD: process.env.SERVER_HOST
      },
      auth
    );

    const commandAddSupportUser = result["result"];

    result = await this.restCommand(
      "imbot.command.register",
      {
        BOT_ID: botId,
        COMMAND: "deletesupportuser",
        COMMON: "N",
        HIDDEN: "N",
        EXTRANET_SUPPORT: "N",
        LANG: [
          {
            LANGUAGE_ID: "ru",
            TITLE: "Удалить пользователя из группы поддержки",
            PARAMS: "id пользователя"
          }
        ],
        EVENT_COMMAND_ADD: process.env.SERVER_HOST
      },
      auth
    );

    const commandDeleteSupportUser = result["result"];

    // save params
    let newConfig = {};
    newConfig[token] = {
      BOT_ID: botId,
      COMMAND_MASSSEND: commandMassSend,
      COMMAND_ADDSUPPORTUSER: commandAddSupportUser,
      COMMAND_DELETESUPPORTUSER: commandDeleteSupportUser,
      AUTH: auth
    };
    Db.saveConfig(newConfig);
  };

  checkAuth = token => {
    const configs = Db.getConfigs();
    console.log("Got new configs: ", configs);
    return configs.find(configObj => Object.keys(configObj).includes(token));
  };

  searchUsersByDepartment = async (departmentToSearch, auth) => {
    let result;
    result = await this.restCommand(
      "im.search.user.list",
      { FIND: departmentToSearch },
      auth
    );
    return result.result;
  };

  commandAnswer = async (commandId, commandMsg, msg, attach, auth) => {
    const result = await this.restCommand(
      "imbot.command.answer",
      {
        COMMAND_ID: commandId,
        MESSAGE_ID: commandMsg,
        MESSAGE: msg,
        ATTACH: attach
      },
      auth
    );
    return result;
  };

  restCommand = async (method, params = {}, auth = {}, authRefresh = true) => {
    const queryUrl = `${auth["client_endpoint"]}${method}`;
    const queryData = querystring.stringify({
      ...params,
      auth: auth["access_token"]
    });
    console.log("restCommand method: ", method);
    console.log("restCommand params: ", params);
    console.log("restCommand Url: ", queryUrl);

    let result;
    try {
      const response = await fetch(`${queryUrl}/?${queryData}`);
      result = await response.json();
      if("result" in result) {
        console.log("restCommand response result: ", result["result"]);
      } else {
        console.log("restCommand response error: ", result);
      }
    } catch (err) {
      console.log("restCommand fetch error: ", err);
      return false;
    }

    if (
      authRefresh &&
      result["error"] &&
      (result["error"]["expired_token"] || result["error"]["invalid_token"])
    ) {
      auth = await this.restAuth(auth);
      if (auth) {
        result = await this.restCommand(method, params, auth, false);
        console.log("restCommand response w/o auth: ", result);
      }
    }
    return result;
  };

  restAuth = async auth => {
    if (!process.env.BITRIX_CLIENT_ID || !process.env.BITRIX_CLIENT_SECRET) {
      console.log("Error: No env vars");
      return false;
    }

    if (!auth["refresh_token"]) {
      console.log("Error: No refresh_token");
      return false;
    }

    const queryUrl = "https://oauth.bitrix.info/oauth/token/";

    const queryData = querystring.stringify({
      grant_type: "refresh_token",
      client_id: process.env.BITRIX_CLIENT_ID,
      client_secret: process.env.BITRIX_CLIENT_SECRET,
      refresh_token: auth["refresh_token"]
    });

    let result;

    try {
      const response = await fetch(`${queryUrl}?${queryData}`);
      result = await response.json();
      console.log("restAuth response: ", result);
    } catch (err) {
      console.log("Auth fetch error: ", err);
      result = false;
    }

    if (!result["error"]) {
      console.log("restAuth success");
      result["application_token"] = auth["application_token"];
      config[auth["application_token"]]["AUTH"] = result;
      console.log("New config: ", config);
      const savingResult = Db.saveConfig(config);
      if (!savingResult) {
        //TODO send message about savingResult error
      }
    } else {
      console.log("Auth error: ", result);
      result = false;
    }
    return result;
  };
}

module.exports = Bitrix;
