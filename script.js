var top_z = 10;

function bringToTop(element) {
  element.style.zIndex = ++top_z;
}

const options = {
  bottom: "40px",
  right: "40px",
  left: "unset",
  time: "0.5s",
  mixColor: "#fff",
  backgroundColor: "#fff",
  buttonColorDark: "#100f2c",
  buttonColorLight: "#fff",
  saveInCookies: true,
  label: "🌓",
  autoMatchOsTheme: false,
};

const darkmode = new Darkmode(options);
darkmode.showWidget();
