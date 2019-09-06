function openTab(evt, tabName) {
  var parent = evt.currentTarget.parentElement.parentElement;

  // Get all elements with class="tabcontent" and hide them
  var tabs = parent.getElementsByClassName("tabcontent");
  for (var i = 0; i < tabs.length; i++) {
    var item = tabs[i];
    item.style.display = item.id == tabName ? "block" : "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  var buttons = parent.getElementsByClassName("tablinks");
  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    button.className = button.className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  evt.currentTarget.className += " active";
}

function showPage(parentId, pageIndex) {
  var parents = [$('#content-main'), $('#timeSeries-home')];
  parents.forEach(function (tabParent) {
    if (tabParent.selector == parentId) {
      tabParent.show();

      var buttons = tabParent.find("div.tab").find("button");

      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (i == pageIndex)
          button.setAttribute("class", "tablinks active");
        else
          button.setAttribute("class", "tablinks");
      }

      var tabs = tabParent.find("div.tabcontent");
      for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        tab.style.display = i == pageIndex ? "block" : "none";
      }
    }
    else {
      tabParent.hide();
    }
  });
}
