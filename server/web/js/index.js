$(function(){

  // UI blocking functions
  function blockUI(msg) {
    $('#global').block({
      message: '<h2>' + msg + '</h2>',
      centerY: false, // Fix weird position issue in some modern browsers
      css: { fontSize:'150%', padding:'1% 2%', top:'45%', borderWidth:'3px', borderRadius:'10px', '-webkit-border-radius':'10px', '-moz-border-radius':'10px' },
    });  
  };
  
  function unblockUI() {
    $('#global').unblock();
  };

  blockUI("Connecting...");

  require("jquery.rotatecells");
 
  // create itp elements and attach events
  include("jquery.editable.itp", function(){
    var $target = $('#target'), $source = $('#source');
    var $canvas = $('#drawing-canvas'), $epen = $('#epen');
      
   
    $target.one('ready', function() {
      updateConfidenceSlider();
      updatePrioritySlider();
      toggleControlPanel();
      $('#matrix, #btn-alignments, #btn-updatedsentences, #updatedsentences').hide();
      if (casmacat.htrServer) {
        $('#btn-epen').click();
      }
    })
    .on('unready', function(ev, msg) {
      blockUI(msg);
    })
    .on('ready', function(ev, msg) {
      unblockUI();
    })
    .editableItp({
      debug: true,
      sourceSelector: '#source',
      itpServerUrl:   'http://' + casmacat.itpServer + '/casmacat'
    });

    // CatClient callbacks -------------------------------------------------------
    
    $target.on('decode', function(ev, data, err) {
      $('#btn-translate').val("Translate").attr("disabled", false);
    });

    // Receive server configuration 
    $target.on('serverconfig', function(ev, data, err) {
      console.log('server config obtained', data);
      var c = data.config;
      if (c) {
        if (c.sentences && c.sentences.length > 0) {
          var $select = $('select#source-list');
          $select.empty();
          $('#source, #target').empty();
          $.each(c.sentences, function(index, value) {
            $select.append( $('<option value="'+value+'">'+trimText(value, 12)+'</option>') );
          });
          $source.text( $select.first().val() );
        }
        if (c.confidencer && c.confidencer.thresholds) {
          updateConfidenceSlider(c.confidencer.thresholds);
        }
        if (c["word-prioritizer"]) {
          var pris = c["word-prioritizer"]; 
          if (!pris instanceof Array) pris = [pris]; 
          var $select = $('select#opt-prioritizer');
          $select.html( $('<option value="none">None</option>') );
          for (var i = 0; i < pris.length; ++i) {
            $select.append( $('<option value="'+pris[i].id+'">'+pris[i].id+'</option>') );
          }
          if (pris[0].threshold) {
            updatePrioritySlider(pris[0].threshold);
          }
        }
        reposHtrCanvas();
      }
    });

    // Handle updates changes (show a list of updated sentences) 
    $target.on('validatedcontributions', function(ev, data, err) {
      var contribs = data.contributions;
      console.log('Validated contributions:', contribs);
      if (contribs.length > 0) {
        var list = '<dl>';
        for (var i = 0; i < contribs.length; ++i) {
          var sentence = [i];
          list += '<dt>' + sentence[0] + '</dt>';
          list += '<dd>' + sentence[1] + '</dd>';
        }
        list += '</dl>';
        $('#updatedsentences').html(list).toggle();
      }
    });

    // Handle models changes (after OL) 
    $target.on('validate', function(data, err) {
      //console.log('models:', data);
      $('#btn-update').val('Update').attr('disabled', false);
    });
    

    // UI events -----------------------------------------------------------------

    // on blur hide suggestions
    $target.blur(function(e) {
      $('#suggestions').css({'visibility': 'hidden'});
    })

    $('#btn-epen').click(function(e) {
      var $this = $('img', this);
      
      if ($this.data('mode') === 'epen') {
        $this.attr('src', 'images/epen.png');
        $this.data('mode', 'keyboard');
        $epen.css({ visibility: 'hidden' });
        $target.css({ borderColor:'steelBlue', backgroundColor:'whiteSmoke' });
      } else {
        $this.attr('src', 'images/keyboard.png');
        $this.data('mode', 'epen');
        $target.css({ borderColor:'white' }); // add backgroundColor:'white' ?
        $epen.css({ visibility: 'visible' });
        reposHtrCanvas();
      }
      
      $target.blur();
    });

    $('#btn-alignments').click(function(e) {
      $('#matrix').toggle();
    });

    $('#btn-updatedsentences').click(function(e) {
      $target.editableItp('getValidatedContributions');
    });
    
    $('#btn-reset').click(function(e) {
      if (!window.confirm("Are you sure you want to reset the models?")) return;
      blockUI("Reseting server...");
      $target.editableItp('reset');
    });

    $('#btn-translate').click(function(e) {
      $('.drawhere').remove();
      $target.editableItp('setTargetText', "");
      $target.editableItp('decode');
      $(this).val("Loading...").attr("disabled", true);
    });

    $('#btn-update').click(function(e) {
      $(this).val('Updating...').attr('disabled', true);
      $target.editableItp('validate');
    });

    $('#show-options input, #show-options select').change(function() {
      var show_type = $('input[@name=show]:checked').val();
      switch(show_type) {
        case 'PE':
        case 'ITP':
          $('#btn-update').attr("disabled", true);
          $('#btn-updatedsentences, #updatedsentences').hide();
          break;
        case 'ITP-OL':
          $('#btn-update').attr("disabled", false);
          $('#btn-updatedsentences').show();
          break;
        default:
          console.warning("#show-options changed, but no action was performed");
          break;
      }
      $target.editableItp('updateConfig', {suggestions:$('#opt-suggestions').is(':checked'), mode:show_type, prioritizer:$('#opt-prioritizer').val()});
    });


    /*******************************************************************************/
    /*           update the HTML display and attach events                         */
    /*******************************************************************************/

    
    function update_suggestions(data) {
      var $target = $target, 
          targetText = $target.text(),
          d = $target.editable('getCaretXY'),
          show_type = $('input[@name=show]:checked').val(),
          count = 0,
          list = $('<dl/>');
          
      if (!data || !data.nbest) return;
      for (var i = 0; i < data.nbest.length; i++) {
        var match = data.nbest[i];
        // XXX: If prediction came from click in the middle of a token, then the
        // sentence is not updated; since the following condition does not match:
        // The prefix in the sentence does not match the prefix in the prediction.
        if (targetText.substr(0, d.pos) === match.target.substr(0, d.pos)) {
          if (show_type === match.author) {
            $target.editable('setText', match.target, match.targetSegmentation);

            if (match.priorities) {
              update_word_priorities($target, match.priorities);
            }
        
            // requests the server for new alignment and confidence info
            var query = {
              source: $source.editable('getText'),
              target: match.target,
            }
            if ($('#opt-alignments').is(':checked')) {
              $target.getAlignments(query);
            }
            if ($('#opt-confidences').is(':checked')) {
              $target.getConfidences(query);
            }
          } else if ($('#opt-suggestions').is(':checked')) {
            list.append($('<dt/>').text(match.author));
            list.append($('<dd/>').text(match.target.substr(d.pos)));
            count++;
          }
        }
      }

      if (count > 0 && $('#btn-epen > img').data('mode') !== 'epen') {
        var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
        $('#suggestions').css({top: d.caretRect.bottom, left: d.caretRect.left - siz.width/2, visibility: 'visible'}).html(list);
        //$target.editable('setText', target, targetSegmentation);
      }
      else {
        $('#suggestions').css({'visibility': 'hidden'}).html('');
      }
    };


    // updates the translation display and queries for new alignments and word confidences
    function update_translation_display(data) {
      // getTokens doesn't have nbest, so this check is required
      var bestResult = data.nbest ? data.nbest[0] : data;
      var source     = data.source,
          sourceSeg  = data.sourceSegmentation,
          target     = bestResult.target,
          targetSeg  = bestResult.targetSegmentation;
      
      // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
      $source.editable('setText', source, sourceSeg);
      $target.editable('setText', target, targetSeg);

      // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
      // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
      updateTable($('#demo-table'), tokenize_by_segments(source, sourceSeg), tokenize_by_segments(target, targetSeg));

      // requests the server for new alignment and confidence info
      var query = {
        source: source,
        target: target,
        //validated_words: []
      }
      if ($('#opt-alignments').is(':checked')) {
        $target.getAlignments(query);
      }
      if ($('#opt-confidences').is(':checked')) {
        $target.getConfidences(query);
      }
    };


    // update the alignments in the alignment matrix
    function update_aligment_matrix(alignments) {
      // update alignment matrix info
      for (var c = 0; c < alignments.length; ++c) {
        var alignment = alignments[c];          
        for (var v = 0; v < alignment.length; ++v) {
          $("#demo-table tbody tr:eq("+c+") td:eq("+v+")")
            .css('background-color', grayColor(alignment[v]));
        }        
      }

      if ($('#opt-alignments').is(':checked') && $('#matrix').is(":visible")) {
        update_aligment_matrix(alignments);
      }
    };


    function update_aligment_matrix(confidences) {
      for (var c = 0; c < confidences.length; ++c) {
        var $span = $(spans[c]), conf = Math.round(confidences[c]*100)/100, cssClass;
        // also update bottom of alignment matrix with values
        $("#demo-table tfoot tr td:eq("+(c+1)+")").text(conf);
      }
    };
        
    function updateTable(table, src, tgt) {
      if (!$('#matrix').is(":visible")) return;
      //console.log(table);
      var src_tok = getTokens($('tbody tr', table).find('th.right:eq(0)'));
      var tgt_tok = getTokens($('thead th:gt(0)', table));

      var src_merge = merge_tokens(src_tok, src);
      var tgt_merge = merge_tokens(tgt_tok, tgt);

      var ndel = 0, nins = 0;
      for (var ml = 0; ml < src_merge.length; ml++) {
        var merge_pos  = src_merge[ml][0], 
            row        = src_merge[ml][1];
            merge_type = src_merge[ml][2];

        //console.log(merge_pos, row, merge_type);

        if (merge_type === 'D') {
          merge_pos += nins - ndel ;
          $('tbody tr:eq(' + merge_pos + ')', table).remove();
          ndel++;
        }
        else if (merge_type === 'S') {
          merge_pos += nins - ndel;
          $('tbody tr:eq(' + merge_pos + ') th', table).text(src[row]).rotateCells();
        }
        else if (merge_type === 'I') {
          var row_html =     '<tr>';
          row_html +=        '<th class="right">' + $('<span/>').text(src[row]).text() + '</th>';
          for (var t = 0; t < tgt_tok.length; ++t) {
            row_html +=      '<td>&nbsp;</td>';
          }
          row_html +=        '<th class="left">' + $('<span/>').text(src[row]).text() + '</th>';
          row_html +=      '</tr>';

          $('tbody tr:eq(' + row + ')', table).before(row_html);

          nins++;
        }
      };

      var ndel = 0, nins = 0;
      for (var ml = 0; ml < tgt_merge.length; ml++) {
        var merge_pos  = tgt_merge[ml][0], 
            col        = tgt_merge[ml][1];
            merge_type = tgt_merge[ml][2];

        if (merge_type === 'D') {
          merge_pos += nins - ndel ;
          $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).remove();
          $('tbody tr', table).not(':last').each(function () { $('td:eq(' + merge_pos + ')', this).remove();});
          //$('tfoot tr td:eq(' + (merge_pos + 1) + ')', table).remove();
          ndel++;
        }
        else if (merge_type === 'S') {
          merge_pos += nins - ndel;
          $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).text(tgt[col]).data('rotated', false);
        }
        else if (merge_type === 'I') {
          //console.log(merge_pos, col, merge_type);
          if (col === 0) {
            $('thead tr th:first, tbody tr:last th:first', table).each(function() {
              var th = $('<th class="vertical">' + tgt[col] + '</th>');
              $(this).after(th);
            });
            $('tbody tr', table).not(':last').each(function () { $('th:eq(0)', this).after('<td>&nbsp;</td>');});
            //$('tfoot tr td:first', table).after('<td></td>');
          } else {
            $('thead tr th:eq(' + col + '), tbody tr:last th:eq(' + col + ')', table).each(function() {
              var th = $('<th class="vertical">' + tgt[col] + '</th>');
              $(this).after(th);
            });
            $('tbody tr', table).not(':last').each(function () { $('td:eq(' + (col - 1) + ')', this).after('<td>&nbsp;</td>');});
            //$('tfoot tr td:eq(' + col + ')', table).after('<td></td>');
          }
          nins++;
        }
        
      }

      table.rotateCells();
    };


    $("#opt-suggestions").click(function(e){
    });

    $("#opt-confidences").click(function(e){
      $('#conf-thresholds').toggle();
    });
      
    $("#opt-alignments").click(function(e){
      if ($(this).is(':checked')) {
        $('#btn-alignments, #matrix').show();
      } else {
        $('#btn-alignments, #matrix').hide();
      }
    });

    $("#opt-prioritizer").change(function(e){
      if (typeof currentCaretPos != 'undefined' && currentCaretPos.token) {
        update_word_priority_display($target, $(currentCaretPos.token.elem));
      }
    });


    $source.text($('#source-list').val());
    $('#source-list').change(function(e) {
      $source.text($('#source-list').val());
      $('#btn-translate').click();
      $target.focus();
    });

    
    var $ctrlLegend = $('#control-panel legend');
    $ctrlLegend.wrapInner('<a href="#toggle-options"/>');
    $ctrlLegend.find('a').click(function(e){
      e.preventDefault();
      toggleControlPanel();
    });

	  $('#slider-conf').slider({
      range: true,
      min: 0,
      max: 100,
      values: [ 3, 30 ],
      slide: function(event, ui) {
        updateConfidenceSlider(ui.values);
      }
    });

	  $('#slider-priority').slider({
      min: 1,
      max: 10,
      value: 1,
      slide: function(event, ui) {
        updatePrioritySlider(ui.value);
      }
    });
      
    function updateConfidenceSlider(values) {
      if (!values) values = $('#slider-conf').slider("option", "values");
      confThreshold = {
        bad: values[0]/100,
        doubt: values[1]/100
      };
      
      $('#slider-bad').text(values[0]);
      $('#slider-doubt').text(values[1]);

      // get target span tokens 
      var spans = $('#target > .editable-token');    
      // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
      for (var c = 0; c < spans.length; ++c) {
        $span = $(spans[c]);
        $span.removeClass('wordconf-ok wordconf-doubt wordconf-bad');
        var conf = $span.data('confidence');
        if (conf) {
          var cssClass;
          if (conf > confThreshold.doubt /*|| typedWords.hasOwnProperty($span.attr("id"))*/) {
            cssClass = 'wordconf-ok';
          }
          else if (conf > confThreshold.bad) {
            cssClass = 'wordconf-doubt';
          }
          else {
            cssClass = 'wordconf-bad';
          }
          $(spans[c]).addClass(cssClass);
        }
      }            
    };

    function updatePrioritySlider(value) {
      if (!value) value = $('#slider-priority').slider("option", "value");
      $('#slider-priority-text').text(value);
      if (typeof currentCaretPos != 'undefined' && currentCaretPos.token) {
        update_word_priority_display($target, $(currentCaretPos.token.elem));
      }
    };
      
    function toggleControlPanel() {
      var $options = $('#options'), $summary = $('#options-summary');
      $options.toggle();
      if (!$options.is(':visible')) {
        makeControlPanelSummary();
        $summary.show();
      } else {
        $summary.hide();
      }
      reposHtrCanvas();
    };
    
    function makeControlPanelSummary() {
      $('#set-mode').text( $('#show-options input[@name=show]:checked').val() );
      $('#set-suggestions').text( $('#opt-suggestions').is(':checked') );
      $('#set-confidences').text( $('#opt-confidences').is(':checked') + " ["+ confThreshold.bad*100 + "/"+ confThreshold.doubt*100 +"]" );
      $('#set-alignments').text( $('#opt-alignments').is(':checked') + " [matrix: "+ $('#matrix').is(':hidden') +"]" );
    };

    function reposHtrCanvas() {
      var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
      $epen.css({
        top: pos.top - ofs,
        height: siz.height,
        left: 2, // FIXME: Review this
        width: siz.width,
      });

      $canvas.attr('width', $canvas.width());
      $canvas.attr('height', $canvas.height());
      //$canvas.sketchable('clear');
    };

    var lastTargetHeight = 0;
    function reposHtrCanvasIfTargetResized() {
      var currTargetHeight = $target.height();
      if (currTargetHeight != lastTargetHeight) reposHtrCanvas();
      lastTargetHeight = currTargetHeight; 
    }
    $target[0].addEventListener('DOMSubtreeModified', reposHtrCanvasIfTargetResized, false);
    $target[0].addEventListener('DOMCharacterDataModified', reposHtrCanvasIfTargetResized, false);




    function trimText(text, numWords, delimiter) {
      if (!numWords)  numWords  = 5;
      if (!delimiter) delimiter = " ";    
      
      var words = text.split(delimiter), trimmed = "";
      for (var i = 0; i < words.length; ++i) {
        if (i <= numWords) {
          trimmed += words[i] + delimiter;
        } else break;
      }
      if (i > numWords) {
        trimmed += delimiter + "[...]"; 
      }

      return trimmed;
    };

  });
 
});
