var errors = [];
var response = [];
var i = 0;

const fileSelector = document.getElementById("file-selector");
fileSelector.addEventListener("change", (event) => {
  const fileList = event.target.files;
  console.log(`fileList`, fileList);
  resetApp();

  for (const file of fileList) {
    getMetadata(file);
    readFile(file).then((ntids) => {
      //   console.log(Date.now(), ntids);

      progress.max = ntids.length;
      (async () => {
        for (const ntid of ntids) {
          await doNtid(ntid);
        }
      })();
    });
  }
});

function resetApp() {
  i = 0;
  errors = [];
  response = [];
  progress_val.innerHTML = "";
  response_val.innerHTML = "";
  errors_val.innerHTML = "";
  progress.max = 0;
  progress.value = 0;
  save_to_file.disabled = true;
}

function getMetadata(file) {
  // Not supported in Safari for iOS.
  const name = file.name ? file.name : "NOT SUPPORTED";
  // Not supported in Firefox for Android or Opera for Android.
  const type = file.type ? file.type : "NOT SUPPORTED";
  // Unknown cross-browser support.
  const size = file.size ? file.size : "NOT SUPPORTED";
  console.log({ file, name, type, size });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (file.type && String(file.name).indexOf(".csv") === -1) {
      markError(`File is not a csv, ${file.type}, ${file}`);
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", (event) => {
      let fileContent = event.target.result;

      if (!fileContent) {
        markError("Can not open the file");
        reject();
      }

      if (String(fileContent).indexOf(",") !== -1) {
        markError("Bad NTIDs file");
        reject();
      }

      console.log(Date.now(), fileContent);
      return resolve(String(fileContent).trim().split("\n"));
    });

    // load
    reader.readAsText(file);
  });
}

async function doNtid(ntid) {
  progress_val.innerHTML = `${i}/${progress.max}`;

  ntid = String(ntid).replace(/\s+/g, "");

  if (ntid) {
    try {
      const auth = await getNtidToken(ntid);
      const progress = await getProgress(auth.user.id, auth.token);
      await saveNtidResult(progress, ntid, auth);
    } catch (error) {
      markError(error);
    }
  }

  i++;
  progress.value = i;
  progress_val.innerHTML = `${i}/${progress.max}`;

  if (i == progress.max) {
    save_to_file.disabled = false;
  }
}

async function saveNtidResult(progress, ntid, auth) {
  if (progress && "classStatus" in progress) {
    progress["user"] = auth.user;
    console.log(`🚀 > processNtid > progress`, progress);

    response.push(progress);
    response_val.innerHTML = JSON.stringify(response);
  } else {
    throw ntid + " - " + JSON.stringify(progress);
  }
}

async function getNtidToken(ntid) {
  const response = await fetch(
    "https://recommend-trng2.gst.sprint.com/AuthenticationController/api/auth",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ loginId: ntid, password: ntid }), // body data type must match "Content-Type" header
    }
  );
  const auth = response.json(); // parses JSON response into native JavaScript objects

  if (
    !auth ||
    !("token" in auth) ||
    !("user" in auth) ||
    !("id" in auth.user)
  ) {
    console.error(auth);
    throw "Invalid NTID: " + ntid;
  }

  console.log("AUTH:", auth);
  return auth;
}

async function getProgress(studentId, token) {
  const response = await fetch(
    "https://recommend-trng2.gst.sprint.com/UserController/getStudentProgressByClass",
    {
      method: "POST",

      headers: new Headers({
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      }),

      body: JSON.stringify({ studentId }),
    }
  );
  return response.json();
}

function download() {
  var data = response_val.innerHTML;
  var file = new Blob([data], { type: "text/json" });
  var filename =
    "sprint-ntt-" + new Date().toISOString().split("T").shift() + ".json";
  if (window.navigator.msSaveOrOpenBlob)
    // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else {
    // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
}

function markError(error) {
  errors.push(error);
  errors_val.innerHTML = JSON.stringify(errors);
}
