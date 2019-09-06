(function () {
  "use strict";

  const realm = 'com.weareadaptive.reactivetrader'
  const defaultPort = 8000
  const host = 'localhost'

  var cellToHighlight;
  var messageBanner;
  var connection;
  var messagecounter = 0;
  var ratesTables = [];

  // The initialize function must be run each time a new page is loaded.
  Office.initialize = function (reason) {
    $(document).ready(function () {
      // Initialize the FabricUI notification mechanism and hide it
      var element = document.querySelector('.ms-MessageBanner');
      messageBanner = new fabric.MessageBanner(element);
      messageBanner.hideBanner();

      $('#welcome-tab').click(function () { openTab(event, 'welcome-page'); });
      $('#trades-tab').click(function () { openTab(event, 'trades-page'); });
      $('#rates-tab').click(function () { openTab(event, 'rates-page'); });

      $("#template-description").text("This sample highlights the highest value from the cells you have selected in the spreadsheet.");
      $('#highlight-button-text').text("Highlight!");
      $('#highlight-button-desc').text("Highlights the largest number.");
      $('#highlight-button').click(hightlightHighestValue);

      $('#rates-button-text').text("Get Rates Table");
      $('#rates-button-desc').text("Creates a table at your active cell");
      $('#rates-button').click(displayratestable);

      showPage('#content-main', 0);
      loadSampleData();
      connecttoserver();
    });
  };

  function connecttoserver() {
    const url = `ws://${host}:${defaultPort}/ws`
    $('#autobahn-status').html('opening ' + url);

    try {
      connection = new autobahn.Connection({
        realm,
        use_es6_promises: true,
        max_retries: -1, // unlimited retries,
        transports: [
          {
            type: 'websocket',
            url: url,
          }
        ],
      })

      connection.onopen = (session, details) => {
        $('#autobahn-status').html('opened');
        try {
          session.subscribe('status', receive_events, { match: 'wildcard' });
        } catch (e) {
          $('#autobahn-status').html('subscribe error ' + e);
          errorHandler(e);
          return;
        }
      }
      connection.onclose = session => { $('#autobahn-status').html('closed'); }
      connection.open();
    } catch (e) {
      $('#autobahn-status').html('opening ' + url + ' error ' + e);
      errorHandler(e);
    }
  }

  function receive_events(args) {
    messagecounter++;
    //$('#autobahn-status').html('received rates');
    $('#autobahn-status').html(messagecounter.toString());

    updateratestables("EUR/USD", messagecounter)
  }

  //Debug function to print the contents of a js object
  function debug_print(o) {
    var s = '';
    for (var p in o) s += p + ':' + o[p] + '<br /><br />';
    return s;
  }

  function loadSampleData() {
    var values = [
      [Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000)],
      [Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000)],
      [Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000)]
    ];

    // Run a batch operation against the Excel object model
    Excel.run(function (ctx) {
      // Create a proxy object for the active sheet
      var sheet = ctx.workbook.worksheets.getActiveWorksheet();
      // Queue a command to write the sample data to the worksheet
      sheet.getRange("B3:D5").values = values;

      // Run the queued-up commands, and return a promise to indicate task completion
      return ctx.sync();
    })
      .catch(errorHandler);
  }

  function hightlightHighestValue() {
    // Run a batch operation against the Excel object model
    Excel.run(function (ctx) {
      // Create a proxy object for the selected range and load its properties
      var sourceRange = ctx.workbook.getSelectedRange().load("values, rowCount, columnCount");

      // Run the queued-up command, and return a promise to indicate task completion
      return ctx.sync()
        .then(function () {
          var highestRow = 0;
          var highestCol = 0;
          var highestValue = sourceRange.values[0][0];

          // Find the cell to highlight
          for (var i = 0; i < sourceRange.rowCount; i++) {
            for (var j = 0; j < sourceRange.columnCount; j++) {
              if (!isNaN(sourceRange.values[i][j]) && sourceRange.values[i][j] > highestValue) {
                highestRow = i;
                highestCol = j;
                highestValue = sourceRange.values[i][j];
              }
            }
          }

          cellToHighlight = sourceRange.getCell(highestRow, highestCol);
          sourceRange.worksheet.getUsedRange().format.fill.clear();
          sourceRange.worksheet.getUsedRange().format.font.bold = false;

          // Highlight the cell
          cellToHighlight.format.fill.color = "orange";
          cellToHighlight.format.font.bold = true;
        })
        .then(ctx.sync);
    })
      .catch(errorHandler);
  }

  // Paints a new table at the current active cell
  function displayratestable() {
    Excel.run(function (ctx) {
      var activeCell = ctx.workbook.getSelectedRange().load("columnIndex, rowIndex");
      var activeSheet = activeCell.worksheet.load("name");

      return ctx.sync()
        .then(function () {

          var currencyPairs = [
            ["EUR/USD", 1.1],
            ["USD/JPY", 106.5],
            ["GBP/JPY", 131.5],
            ["GBP/USD", 1.23]
          ];

          var tableRange = activeSheet.getRangeByIndexes(activeCell.rowIndex, activeCell.columnIndex, 1, 2);
          var ratesTable = activeSheet.tables.add(tableRange, true).load("name");
          ratesTable.getHeaderRowRange().values = [["Symbol", "Rate"]];
          ratesTable.rows.add(null, currencyPairs);

          if (Office.context.requirements.isSetSupported("ExcelApi", "1.2")) {
            tableRange.format.autofitColumns();
            tableRange.format.autofitRows();
          }
          activeSheet.activate();
          return ctx.sync()
            .then(function () {
              ratesTables.push({ sheetName: activeSheet.name, tableName: ratesTable.name });
            });
        })
        .then(ctx.sync);
    })
      .catch(errorHandler);
  }

  // Search through all the rates tables in this workbook, update value on the row located by symbol 
  // This could probably be made more efficient by using bindings but that is an exercise for the future
  function updateratestables(symbol, newRate) {
    $('#rates-status').html( symbol + ': ' + newRate);
    Excel.run(function (ctx) {
      for (var t = 0; t < ratesTables.length; t++) {
        var workSheet = ctx.workbook.worksheets.getItem(ratesTables[t].sheetName).load("name, tables");
        return ctx.sync()
          .then(function () {
            var ratesTable = workSheet.tables.getItem(ratesTables[t].tableName).load("name, rows");
            return ctx.sync()
              .then(function () {
                for (var r = 0; r < ratesTable.rows.count; r++) {
                  var tableRow = ratesTable.rows.getItemAt(r).getRange().load("values");
                  return ctx.sync()
                    .then(function () {
                      if (tableRow.values[0][0] == symbol) {
                        tableRow.values = [[symbol, newRate]];
                        ctx.sync();
                      }
                    });
                }
              })
              .then(ctx.sync);
          });
      }
      return ctx.sync();
    }).catch(errorHandler);
  }
  

  // Helper function for displaying errors at the bottom of the task pane to make debugging much easier
  function errorHandler(error) {
    // Always be sure to catch any accumulated errors that bubble up from the Excel.run execution
    showNotification("Error", error);
    console.log("Error: " + error);
    if (error instanceof OfficeExtension.Error) {
      console.log("Debug info: " + JSON.stringify(error.debugInfo));
    }
  }

  // Helper function for displaying notifications
  function showNotification(header, content) {
    $("#notification-header").text(header);
    $("#notification-body").text(content);
    messageBanner.showBanner();
    messageBanner.toggleExpansion();
  }
})();
