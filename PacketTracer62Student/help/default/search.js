// ----------------------------------------------------------------------------
// Zoom Search Engine 5.1 (13/11/2007)
//
// This file (search.js) is the JavaScript search front-end for client side
// searches using index files created by the Zoom Search Engine Indexer.
//
// email: zoom@wrensoft.com
// www: http://www.wrensoft.com
//
// Copyright (C) Wrensoft 2000-2007
//
// This script performs client-side searching with the index data file
// (zoom_index.js) generated by the Zoom Search Engine Indexer. It allows you
// to run searches on mediums such as CD-ROMs, or other local data, where a
// web server is not available.
//
// We recommend against using client-side searches for online websites because
// it requires the entire index data file to be downloaded onto the user's
// local machine. This can be very slow for large websites, and our server-side
// search scripts (available for PHP, ASP and CGI) are far better suited for this.
// However, JavaScript is still an option for smaller websites in a limited
// hosting situation (eg: your web host does not support PHP, ASP or CGI).
// ----------------------------------------------------------------------------

// Include required files for index data, settings, etc.
document.write("<script language=\"JavaScript\" src=\"zoom_index.js\" charset=\"" + Charset + "\"><\/script>");
document.write("<script language=\"JavaScript\" src=\"zoom_pageinfo.js\" charset=\"" + Charset + "\"><\/script>");

document.write("<meta http-equiv=\"content-type\" content=\"text/html; charset=" + Charset + "\">");

// ----------------------------------------------------------------------------
// Settings (change if necessary)
// ----------------------------------------------------------------------------

// The options available in the dropdown menu for number of results
// per page
var PerPageOptions = new Array(10, 20, 50, 100);

// Globals
var SkippedWords = 0;
var searchWords = new Array();
var RegExpSearchWords = new Array();
var SkippedOutputStr = "";

var months = new Array('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec');

// Index format
var PAGEDATA_URL = 0;
var PAGEDATA_TITLE = 1;
var PAGEDATA_DESC = 2;
var PAGEDATA_IMG = 3;
var PAGEINFO_DATETIME = 0;
var PAGEINFO_FILESIZE = 1;
var PAGEINFO_CAT = 2;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

// This function will return the value of a GET parameter
function getParam(paramName)
{
    paramStr = document.location.search;
    if (paramStr == "")
        return "";

    // remove '?' in front of paramStr
    if (paramStr.charAt(0) == "?")
        paramStr = paramStr.substr(1);

    arg = (paramStr.split("&"));
    for (i=0; i < arg.length; i++) {
        arg_values = arg[i].split("=")
        if (unescape(arg_values[0]) == paramName) 
        {
        	if (paramName == "zoom_query")
        		arg_values[1] = arg_values[1].replace(/[\+]/g, " ");  // replace the '+' with spaces
        		        		
            if (UseUTF8 == 1 && self.decodeURIComponent) // check if decodeURIComponent() is defined
                ret = decodeURIComponent(arg_values[1]);
            else
                ret = unescape(arg_values[1]);  // IE 5.0 and older does not have decodeURI
            return ret;
        }
    }
    return "";
}

function getParamArrayInt(paramName)
{
    paramStr = document.location.search;

    var retArray = new Array();
    var retCount = 0;

    if (paramStr == "")
        return retArray;

    // remove '?' in front of paramStr
    if (paramStr.charAt(0) == "?")
        paramStr = paramStr.substr(1);

    arg = (paramStr.split("&"));
    for (i=0; i < arg.length; i++) 
    {
        arg_values = arg[i].split("=")
        if (unescape(arg_values[0]) == paramName) 
        {
            if (UseUTF8 == 1 && self.decodeURIComponent) // check if decodeURIComponent() is defined
                ret = decodeURIComponent(arg_values[1]);
            else
                ret = unescape(arg_values[1]);  // IE 5.0 and older does not have decodeURI            
                
            if (isNaN(ret) == false)
            {
            	retArray[retCount] = ret;
            	retCount++;            
            }
        }
    }
    return retArray;    
}

// Compares the two values, used for sorting output results
// Results that match all search terms are put first, highest score
function SortCompare (a, b)
{
    if (a[2] < b[2]) return 1;
    else if (a[2] > b[2]) return -1;
    else if (a[1] < b[1]) return 1;
    else if (a[1] > b[1]) return -1;
    else return 0;
}

function SortByDate(a, b)
{   
    if (pageinfo[a[0]][PAGEINFO_DATETIME] < pageinfo[b[0]][PAGEINFO_DATETIME]) return 1;
    else if (pageinfo[a[0]][PAGEINFO_DATETIME] > pageinfo[b[0]][PAGEINFO_DATETIME]) return -1;
    else return SortCompare(a, b);
}

function sw_compare(a, b)
{
    if (a.charAt(0) == '-') 
        return 1;
    
    if (b.charAt(0) == '-') 
        return -1;
    
    return 0;
}

function pattern2regexp(pattern)
{
    pattern = pattern.replace(/\#/g, "\\#");
    pattern = pattern.replace(/\$/g, "\\$");
    pattern = pattern.replace(/\./g, "\\.");
    pattern = pattern.replace(/\*/g, "[\\d\\S]*");
    pattern = pattern.replace(/\?/g, ".?");
    return pattern;
}

function PrintHighlightDescription(line) 
{
    if (Highlighting == 0)
    {
        document.writeln(line);
        return;
    }
        
    res = " " + line + " ";
    for (i = 0; i < numwords; i++) {
        if (RegExpSearchWords[i] == "")
            continue;

        if (SearchAsSubstring == 1)
            res = res.replace(new RegExp("("+RegExpSearchWords[i]+")", "gi"), "[;:]$1[:;]");
        else
            res = res.replace(new RegExp("(\\W|^|\\b)("+RegExpSearchWords[i]+")(\\W|$|\\b)", "gi"), "$1[;:]$2[:;]$3");
    }
    // replace the marker text with the html text
    // this is to avoid finding previous <span>'ed text.
    res = res.replace(/\[;:\]/g, "<span class=\"highlight\">");
    res = res.replace(/\[:;\]/g, "</span>");
    document.writeln(res);
}

function PrintNumResults(num)
{
    if (num == 0)
        return STR_NO_RESULTS;
    else if (num == 1)
        return num + " " + STR_RESULT;
    else
        return num + " " + STR_RESULTS;
}

function AddParamToURL(url, paramStr)
{
    // add GET parameters to URL depending on 
    // whether there are any existing parameters
    if (url.indexOf("?") > -1)  
        return url + "&amp;" + paramStr;
    else        
        return url + "?" + paramStr;            
}

function SkipSearchWord(sw) {
    if (searchWords[sw] != "") {
        if (SkippedWords > 0)
            SkippedOutputStr += ", ";
        SkippedOutputStr += "\"<b>" + searchWords[sw] + "</b>\"";
        searchWords[sw] = "";
    }
}

function wordcasecmp(word1, word2) {
    if (word1 == word2)
        return 0;
    else
        return -1;  
}

function htmlspecialchars(query) {
    query = query.replace(/\&/g, "&#38;");
    query = query.replace(/\</g, "&#60;");
    query = query.replace(/\>/g, "&#62;");  
    query = query.replace(/\"/g, "&#34;");
    query = query.replace(/\'/g, "&#39;");
    return query;
}

function QueryEntities(query) { 
    query = query.replace(/\&/g, "&#38;");  
    query = query.replace(/\</g, "&#60;");
    query = query.replace(/\>/g, "&#62;");
    query = query.replace(/\'/g, "&#39;");  
    return query;
}

function FixQueryForAsianWords(query) {
    currCharType = 0;
    lastCharType = 0;   // 0 is normal, 1 is hiragana, 2 is katakana, 3 is "han"
    
    // check for hiragana/katakana splitting required
    newquery = "";
    for (i = 0; i < query.length; i++)
    {
        ch = query.charAt(i);
        chVal = query.charCodeAt(i);
        
        if (chVal >= 12352 && chVal <= 12447)
            currCharType = 1;
        else if (chVal >= 12448 && chVal <= 12543)
            currCharType = 2;
        else if (chVal >= 13312 && chVal <= 44031)
            currCharType = 3;
        else
            currCharType = 0;
                        
        if (lastCharType != currCharType && ch != " ")
            newquery += " ";            
        lastCharType = currCharType;                
        newquery += ch;
    }
    return newquery;
}

// ----------------------------------------------------------------------------
// Parameters initialisation (globals)
// ----------------------------------------------------------------------------

var query = getParam("zoom_query");
query = query.replace(/[\"]/g, " ");

var per_page = parseInt(getParam("zoom_per_page"));
if (isNaN(per_page)) per_page = 10;
if (per_page < 1) per_page = 1;

var page = parseInt(getParam("zoom_page"));
if (isNaN(page)) page = 1;

var andq = parseInt(getParam("zoom_and"));
if (isNaN(andq))
{
    if (typeof(DefaultToAnd) != "undefined" && DefaultToAnd == 1)
        andq = 1;
    else
        andq = 0;
}

var cat = getParamArrayInt("zoom_cat[]");
if (cat.length == 0)
{
    cat[0] = parseInt(getParam("zoom_cat"));
    if (isNaN(cat))
        cat[0] = -1;    // search all categories
}
var num_zoom_cats = cat.length; 


// for sorting options. zero is default (relevance)
// 1 is sort by date (if date/time is available)
var sort = parseInt(getParam("zoom_sort"));
if (isNaN(sort)) sort = 0;

var SelfURL = "";
if (typeof(LinkBackURL) == "undefined")
{
    SelfURL = document.location.href;
    // strip off parameters and anchors
    var paramIndex;
    paramIndex = SelfURL.indexOf("?");    
    if (paramIndex > -1)
        SelfURL = SelfURL.substr(0, paramIndex);
    paramIndex = SelfURL.indexOf("#");
    if (paramIndex > -1)
        SelfURL = SelfURL.substr(0, paramIndex);        
}
else
    SelfURL = LinkBackURL;
// encode invalid URL characters
SelfURL = SelfURL.replace(/\</g, "&lt;");
SelfURL = SelfURL.replace(/\"/g, "&quot;");

var data = new Array();
var output = new Array();

target = "";
if (UseLinkTarget == 1)
    target = " target=\"" + LinkTarget + "\" ";

// ----------------------------------------------------------------------------
// Main search function starts here
// ----------------------------------------------------------------------------

function ZoomSearch() 
{
    if (UseCats)
        NumCats = catnames.length;

    if (Timing == 1) {
        timeStart = new Date();
    }        
        
    // Display the form
    if (FormFormat > 0) {
        document.writeln("<form method=\"get\" action=\"" + SelfURL + "\" class=\"zoom_searchform\">");
        document.writeln("<input type=\"text\" name=\"zoom_query\" size=\"20\" value=\"" + htmlspecialchars(query) + "\" class=\"zoom_searchbox\" />");
        document.writeln("<input type=\"submit\" value=\"" + STR_FORM_SUBMIT_BUTTON + "\" class=\"zoom_button\" />");
        if (FormFormat == 2) {
            document.writeln("<span class=\"zoom_results_per_page\">" + STR_FORM_RESULTS_PER_PAGE + "\n");
            document.writeln("<select name=\"zoom_per_page\">");
            for (i = 0; i < PerPageOptions.length; i++) {
                document.write("<option");
                if (PerPageOptions[i] == per_page)
                    document.write(" selected=\"selected\"");
                document.writeln(">" + PerPageOptions[i] + "</option>");
            }
            document.writeln("</select><br /><br /></span>");
            if (UseCats) {
                document.writeln("<span class=\"zoom_categories\">");
                document.write(STR_FORM_CATEGORY + " ");
                if (SearchMultiCats)
                {                                                   
                    document.writeln("<ul>");
                    document.write("<li><input type=\"checkbox\" name=\"zoom_cat[]\" value=\"-1\"");
                    if (cat[0] == -1)
                        document.write(" checked=\"checked\"");
                    document.writeln(">" + STR_FORM_CATEGORY_ALL + "</input></li>");                                
                    for (i = 0; i < NumCats; i++)  
                    {           
                        document.write("<li><input type=\"checkbox\" name=\"zoom_cat[]\" value=\"" +i+ "\"");
                        if (cat[0] != -1)
                        {
                            for (catit = 0; catit < num_zoom_cats; catit++)
                            {
                                if (i == cat[catit])
                                {
                                    document.write(" checked=\"checked\"");
                                    break;
                                }
                            }
                        }
                        document.writeln(">"+catnames[i]+"</input></li>");
                    }
                    document.writeln("</ul><br /><br />");
                }
                else
                {                       
                    document.write("<select name='zoom_cat[]'>");
                    // 'all cats option
                    document.write("<option value=\"-1\">" + STR_FORM_CATEGORY_ALL + "</option>");
                    for (i = 0; i < NumCats; i++) {
                        document.write("<option value=\"" + i + "\"");
                        if (i == cat[0])
                            document.write(" selected=\"selected\"");
                        document.writeln(">" + catnames[i] + "</option>");
                    }
                    document.writeln("</select>&nbsp;&nbsp;");
                }
                document.writeln("</span>");
            }
            document.writeln("<span class=\"zoom_match\">" + STR_FORM_MATCH + " ");
            if (andq == 0) {
                document.writeln("<input type=\"radio\" name=\"zoom_and\" value=\"0\" checked=\"checked\" />" + STR_FORM_ANY_SEARCH_WORDS);
                document.writeln("<input type=\"radio\" name=\"zoom_and\" value=\"1\" />" + STR_FORM_ALL_SEARCH_WORDS);                                
            } else {
                document.writeln("<input type=\"radio\" name=\"zoom_and\" value=\"0\" />" + STR_FORM_ANY_SEARCH_WORDS);
                document.writeln("<input type=\"radio\" name=\"zoom_and\" value=\"1\" checked=\"checked\" />" + STR_FORM_ALL_SEARCH_WORDS);                
            }
            document.writeln("<input type=\"hidden\" name=\"zoom_sort\" value=\"" + sort + "\" />");
            document.writeln("<br /><br /></span>");
        }
        else
        {
            document.writeln("<input type=\"hidden\" name=\"zoom_per_page\" value=\"" + per_page + "\" />");
            document.writeln("<input type=\"hidden\" name=\"zoom_and\" value=\"" + andq + "\" />");
            document.writeln("<input type=\"hidden\" name=\"zoom_sort\" value=\"" + sort + "\" />");
        }
        
        document.writeln("</form>");
    }

    // give up early if no search words provided
    if (query.length == 0) {
        //document.writeln("No search query entered.<br />");        
        if (ZoomInfo == 1)
            document.writeln("<center><p><small>" + STR_POWEREDBY + " <a href=\"http://www.wrensoft.com/zoom/\" target=\"_blank\"><b>Zoom Search Engine</b></a></small></p></center>");
        return;
    }

    if (MapAccents == 1) 
    {
        for (i = 0; i < NormalChars.length; i++)
            query = query.replace(new RegExp(AccentChars[i], "g"), NormalChars[i]);                
    }

    // Special query processing required when SearchAsSubstring is enabled
    if (SearchAsSubstring == 1 && UseUTF8 == 1)
        query = FixQueryForAsianWords(query);

    // prepare search query, strip quotes, trim whitespace
    if (WordJoinChars.indexOf(".") == -1)
        query = query.replace(/[\.]/g, " ");

    if (WordJoinChars.indexOf("-") == -1)
        query = query.replace(/(\S)\-/g, "$1 ");

    if (WordJoinChars.indexOf("#") == -1)
        query = query.replace(/\#(\S)/g, " $1");

    if (WordJoinChars.indexOf("+") == -1)
    {
        query = query.replace(/[\+]+([^\+\s])/g, " $1");
		query = query.replace(/([^\+\s])\+\s/g, "$1 ");
    }

    if (WordJoinChars.indexOf("_") == -1)
        query = query.replace(/[\_]/g, " ");

    if (WordJoinChars.indexOf("'") == -1)
        query = query.replace(/[\']/g, " ");

    if (WordJoinChars.indexOf("$") == -1)
        query = query.replace(/[\$]/g, " ");

    if (WordJoinChars.indexOf("&") == -1)
        query = query.replace(/[\&]/g, " ");

    if (WordJoinChars.indexOf(":") == -1)
        query = query.replace(/[\:]/g, " ");

    if (WordJoinChars.indexOf(",") == -1)
        query = query.replace(/[\,]/g, " ");

    if (WordJoinChars.indexOf("/") == -1)
        query = query.replace(/[\/]/g, " ");

    if (WordJoinChars.indexOf("\\") == -1)
        query = query.replace(/[\\]/g, " ");
        
    // substitute multiple whitespace chars to single character
    // also strip any of the wordjoinchars if followed immediately by a space
    query = query.replace(/[\s\(\)\^\[\]\|\{\}\%]+|[\-._',:&\/\\\\](\s|$)/g, " ");   
    
    // trim trailing/leading whitespace
    query = query.replace(/^\s*|\s*$/g,""); 
    
    var queryForHTML = htmlspecialchars(query);
    var queryForSearch;
    if (ToLowerSearchWords == 1)
        queryForSearch = query.toLowerCase();
    else
        queryForSearch = query;    
    queryForSearch = htmlspecialchars(queryForSearch);    

    // split search phrase into words
    searchWords = queryForSearch.split(" "); // split by spaces.
    
    // Sort search words if there are negative signs
    if (queryForSearch.indexOf("-") != -1)
        searchWords.sort(sw_compare);      

    var query_zoom_cats = "";

    document.write("<div class=\"searchheading\">" + STR_RESULTS_FOR + " " + queryForHTML);
    if (UseCats) {
        if (cat[0] == -1)
        {
            document.writeln(" " + STR_RESULTS_IN_ALL_CATEGORIES);
            query_zoom_cats = "&amp;zoom_cat%5B%5D=-1";
        }
        else
        {
            document.writeln(" " + STR_RESULTS_IN_CATEGORY + " ");
            for (catit = 0; catit < num_zoom_cats; catit++)
            {
                if (catit > 0)
                    document.write(", ");
                document.write("\"" + catnames[cat[catit]] + "\"");
                query_zoom_cats += "&amp;zoom_cat%5B%5D="+cat[catit];
            }
        }
    }
    document.writeln("<br /><br /></div>");

    document.writeln("<div class=\"results\">");

    numwords = searchWords.length;
    kw_ptr = 0;
    outputline = 0;    
    ipage = 0;
    matches = 0;
    var SWord;
    pagesCount = NumPages;
    
    exclude_count = 0;
    ExcludeTerm = 0;
    
    // Initialise a result table the size of all pages
    res_table = new Array(pagesCount);
    for (i = 0; i < pagesCount; i++)
    {
        res_table[i] = new Array(3);
        res_table[i][0] = 0;
        res_table[i][1] = 0;
        res_table[i][2] = 0;
    }
    
    var UseWildCards = new Array(numwords);    
        
    for (sw = 0; sw < numwords; sw++) {

        UseWildCards[sw] = 0;

        if (skipwords) {
            // check min length
            if (searchWords[sw].length < MinWordLen) {
                SkipSearchWord(sw);
                continue;
            }
            // check skip word list
            for (i = 0; i < skipwords.length; i++) {
                if (searchWords[sw] == skipwords[i]) {
                    SkipSearchWord(sw);
                    break;
                }
            }
        }

        if (searchWords[sw].indexOf("*") == -1 && searchWords[sw].indexOf("?") == -1) {
            UseWildCards[sw] = 0;
        } else {
            UseWildCards[sw] = 1;
            RegExpSearchWords[sw] = pattern2regexp(searchWords[sw]);
        }
        
        if (Highlighting == 1 && UseWildCards[sw] == 0)
            RegExpSearchWords[sw] = searchWords[sw];                    
    }
                   
    // Begin searching...
    for (sw = 0; sw < numwords; sw++) {

        if (searchWords[sw] == "") {
            SkippedWords++;
            continue;
        }

        if (searchWords[sw].charAt(0) == '-')
        {           
            searchWords[sw] = searchWords[sw].substr(1);            
            ExcludeTerm = 1;
            exclude_count++;            
        }
        
        if (UseWildCards[sw] == 1) {            
            if (SearchAsSubstring == 0)
                pattern = "^" + RegExpSearchWords[sw] + "$";
            else
                pattern = RegExpSearchWords[sw];
            re = new RegExp(pattern, "g");
        }

        for (kw_ptr = 0; kw_ptr < dictwords.length; kw_ptr++) {

            data = dictwords[kw_ptr].split(" ");

            if (UseWildCards[sw] == 0) {            	
                if (SearchAsSubstring == 0)
                    match_result = wordcasecmp(data[0], searchWords[sw]);
                else
                    match_result = data[0].indexOf(searchWords[sw]);
            } else
                match_result = data[0].search(re);


            if (match_result != -1) {
                // keyword found, include it in the output list
                for (kw = 1; kw < data.length; kw += 2) {
                    // check if page is already in output list
                    pageexists = 0;
                    ipage = data[kw];
                    
                    if (ExcludeTerm == 1)
                    {
                        // we clear out the score entry so that it'll be excluded in the filter stage
                        res_table[ipage][0] = 0;
                    }                    
                    else if (res_table[ipage][0] == 0) {
                        matches++;
                        res_table[ipage][0] += parseInt(data[kw+1]);
                    }
                    else {

                        if (res_table[ipage][0] > 10000) {
                            // take it easy if its too big to prevent gigantic scores
                            res_table[ipage][0] += 1;
                        } else {
                            res_table[ipage][0] += parseInt(data[kw+1]); // add in score
                            res_table[ipage][0] *= 2;           // double score as we have two words matching
                        }
                    }
                    res_table[ipage][1] += 1;
                    // store the 'and' user search terms matched' value
                    if (res_table[ipage][2] == sw || res_table[ipage][2] == sw-SkippedWords-exclude_count)
                        res_table[ipage][2] += 1;

                }
                if (UseWildCards[sw] == 0 && SearchAsSubstring == 0)
                    break;    // this search word was found, so skip to next
            }
        }
    }
    
    if (SkippedWords > 0)
        document.writeln("<div class=\"summary\">" + STR_SKIPPED_FOLLOWING_WORDS + " " + SkippedOutputStr + ".<br /><br /></div>");

    // Count number of output lines that match ALL search terms
    oline = 0;
    fullmatches = 0;    
    output = new Array();
    var full_numwords = numwords - SkippedWords - exclude_count;
    for (i = 0; i < pagesCount; i++) {
        IsFiltered = false;
        if (res_table[i][0] > 0) {
            if (UseCats && cat[0] != -1) {
                // using cats and not doing an "all cats" search
                if (SearchMultiCats) {
                    for (cati = 0; cati < num_zoom_cats; cati++) {                      
                        if (pageinfo[i][PAGEINFO_CAT].charAt(cat[cati]) == "1")
                            break;
                    }
                    if (cati == num_zoom_cats)
                        IsFiltered = true;
                }
                else {                                      
                    if (pageinfo[i][PAGEINFO_CAT].charAt(cat[0]) == "0") {
                        IsFiltered = true;
                    }
                }
            }
            if (IsFiltered == false) {
                if (res_table[i][2] >= full_numwords) {
                    fullmatches++;
                } else {
                    if (andq == 1)
                        IsFiltered = true;
                }
            }
            if (IsFiltered == false) {
                // copy if not filtered out
                output[oline] = new Array(3);
                output[oline][0] = i;
                output[oline][1] = res_table[i][0];
                output[oline][2] = res_table[i][1];
                oline++;
            }
        }
    }
    matches = oline;    

    // Sort results in order of score, use "SortCompare" function
    if (matches > 1)    
    {
        if (sort == 1 && UseDateTime == 1)
            output.sort(SortByDate);    // sort by date
        else
            output.sort(SortCompare);   // sort by relevance
    }
    
    // prepare queryForURL
    var queryForURL = query.replace(/\s/g, "+");
    if (UseUTF8 == 1 && self.encodeURIComponent)
        queryForURL = encodeURIComponent(queryForURL);
    else
        queryForURL = escape(queryForURL);    

    //Display search result information
    document.writeln("<div class=\"summary\">");
    if (matches == 0)
        document.writeln(STR_SUMMARY_NO_RESULTS_FOUND + "<br />");
    else if (numwords > 1 && andq == 0) {
        //OR
        SomeTermMatches = matches - fullmatches;
        document.writeln(PrintNumResults(fullmatches) + " " + STR_SUMMARY_FOUND_CONTAINING_ALL_TERMS + " ");
        if (SomeTermMatches > 0)
            document.writeln(PrintNumResults(SomeTermMatches) + " " + STR_SUMMARY_FOUND_CONTAINING_SOME_TERMS);
        document.writeln("<br />");
    }
    else if (numwords > 1 && andq == 1) //AND
        document.writeln(PrintNumResults(fullmatches) + " " + STR_SUMMARY_FOUND_CONTAINING_ALL_TERMS + "<br />");
    else
        document.writeln(PrintNumResults(matches) + " " + STR_SUMMARY_FOUND + "<br />");

    document.writeln("</div>\n");

    // number of pages of results
    num_pages = Math.ceil(matches / per_page);
    if (num_pages > 1)
        document.writeln("<div class=\"result_pagescount\"><br />" + num_pages + " " + STR_PAGES_OF_RESULTS + "</div>\n");
        
    // Show recommended links if any
    if (Recommended == 1)
    {
        num_recs_found = 0;
        rec_count = recommended.length;
        for (rl = 0; rl < rec_count && num_recs_found < RecommendedMax; rl++)
        {
            sep = recommended[rl].lastIndexOf(" ");
            if (sep > -1)
            {
                rec_word = recommended[rl].slice(0, sep);
                rec_idx = parseInt(recommended[rl].slice(sep));
                for (sw = 0; sw <= numwords; sw++)  
                {
                    if (sw == numwords)
                    {
                        match_result = wordcasecmp(rec_word, queryForSearch);
                    }
                    else
                    {
                        if (UseWildCards[sw] == 1)
                        {
                            if (SearchAsSubstring == 0)
                                pattern = "^" + RegExpSearchWords[sw] + "$";
                            else
                                pattern = RegExpSearchWords[sw];
                            re = new RegExp(pattern, "g");
                            match_result = rec_word.search(re);                         
                        }
                        else if (SearchAsSubstring == 0)
                        {
                            match_result = wordcasecmp(rec_word, searchWords[sw]);
                        }
                        else
                            match_result = rec_word.indexOf(searchWords[sw]);
                    }
                    if (match_result != -1)
                    {
                        if (num_recs_found == 0)
                        {
                            document.writeln("<div class=\"recommended\">");
                            document.writeln("<div class=\"recommended_heading\">" + STR_RECOMMENDED + "</div>");
                        }
                        pgurl = pagedata[rec_idx][PAGEDATA_URL];
                        pgtitle = pagedata[rec_idx][PAGEDATA_TITLE];
                        pgdesc = pagedata[rec_idx][PAGEDATA_DESC];
                        urlLink = pgurl;                        
                        if (GotoHighlight == 1)             
                        {
                            if (SearchAsSubstring == 1)
                                urlLink = AddParamToURL(urlLink, "zoom_highlightsub=" + queryForURL);
                            else
                                urlLink = AddParamToURL(urlLink, "zoom_highlight=" + queryForURL);
                        }           
                        if (PdfHighlight == 1)
                        {
                            if (urlLink.indexOf(".pdf") != -1)
                                urlLink = urlLink+"#search=&quot;"+query+"&quot;";
                        }                       
                        document.writeln("<div class=\"recommend_block\">");
                        document.writeln("<div class=\"recommend_title\">");
                        document.writeln("<a href=\"" + urlLink + "\"" + target + ">");
                        if (pgtitle.length > 1)
                            PrintHighlightDescription(pgtitle);
                        else
                            PrintHighlightDescription(pgurl);
                        document.writeln("</a></div>");                             
                        document.writeln("<div class=\"recommend_description\">")
                        PrintHighlightDescription(pgdesc);
                        document.writeln("</div>");                     
                        document.writeln("<div class=\"recommend_infoline\">" + pgurl + "</div>");
                        document.writeln("</div>");
                        num_recs_found++;                       
                        break;              
                    }
                }               
            }
        }
        if (num_recs_found > 0)
            document.writeln("</div");
    }
    
    // Show sorting options
    if (matches > 1)
    {
        if (UseDateTime == 1)
        {
            document.writeln("<div class=\"sorting\">");
            if (sort == 1)
                document.writeln("<a href=\"" + SelfURL + "?zoom_query=" + queryForURL + "&amp;zoom_page=" + page + "&amp;zoom_per_page=" + per_page + query_zoom_cats + "&amp;zoom_and=" + andq + "&amp;zoom_sort=0\">" + STR_SORTBY_RELEVANCE + "</a> / <b>" + STR_SORTEDBY_DATE + "</b>");
            else
                document.writeln("<b>" + STR_SORTEDBY_RELEVANCE + "</b> / <a href=\"" + SelfURL + "?zoom_query=" + queryForURL + "&amp;zoom_page=" + page + "&amp;zoom_per_page=" + per_page + query_zoom_cats + "&amp;zoom_and=" + andq + "&amp;zoom_sort=1\">" + STR_SORTBY_DATE + "</a>");
            document.writeln("</div>");
        }       
    }    

    // determine current line of result from the output array
    if (page == 1) {
        arrayline = 0;
    } else {
        arrayline = ((page - 1) * per_page);
    }

    // the last result to show on this page
    result_limit = arrayline + per_page;

    // display the results
    while (arrayline < matches && arrayline < result_limit) {
        ipage = output[arrayline][0];
        score = output[arrayline][1];
        
        pgurl = pagedata[ipage][PAGEDATA_URL];
        pgtitle = pagedata[ipage][PAGEDATA_TITLE];
        pgdesc = pagedata[ipage][PAGEDATA_DESC];
        pgimage = pagedata[ipage][PAGEDATA_IMG];                
                
        urlLink = pgurl;                                        
        if (GotoHighlight == 1)             
        {
            if (SearchAsSubstring == 1)
                urlLink = AddParamToURL(urlLink, "zoom_highlightsub=" + queryForURL);
            else
                urlLink = AddParamToURL(urlLink, "zoom_highlight=" + queryForURL);
        }       
        if (PdfHighlight == 1)
        {
            if (urlLink.indexOf(".pdf") != -1)
                urlLink = urlLink+"#search=&quot;"+query+"&quot;";
        } 
                
        if (arrayline % 2 == 0)
            document.writeln("<div class=\"result_block\">");
        else
            document.writeln("<div class=\"result_altblock\">");
        
        if (UseZoomImage == 1)
        {           
            if (pgimage.length > 1)
            {
                document.writeln("<div class=\"result_image\">");           
                document.writeln("<a href=\"" + urlLink + "\"" + target + "><img src=\"" + pgimage + "\" alt=\"\" class=\"result_image\"></a>");
                document.writeln("</div>");
            }
        }
                            
        document.writeln("<div class=\"result_title\">");
        if (DisplayNumber == 1)
            document.writeln("<b>" + (arrayline+1) + ".</b>&nbsp;");
            
        if (DisplayTitle == 1)
        {
            document.writeln("<a href=\"" + urlLink + "\"" + target + ">");
            PrintHighlightDescription(pgtitle);
            document.writeln("</a>");
        }        
        else
            document.writeln("<a href=\"" + urlLink + "\"" + target + ">" + pgurl + "</a>");
                   
        if (UseCats) 
        {           
        	catpage = pageinfo[ipage][PAGEINFO_CAT];        	
            document.write("<span class=\"category\">");
            for (cati = 0; cati < NumCats; cati++)
            {
                if (catpage.charAt(cati) == "1")
                    document.write(" ["+catnames[cati]+"]");
            }             
            document.writeln("</span>");
        }
        document.writeln("</div>");
        
        if (DisplayMetaDesc == 1)
        {
            // print meta description
            document.writeln("<div class=\"description\">");            
            PrintHighlightDescription(pgdesc);
            document.writeln("</div>\n");
        }
        
        info_str = "";
        
        if (DisplayTerms == 1)
            info_str += STR_RESULT_TERMS_MATCHED + " " + output[arrayline][2];
            
        if (DisplayScore == 1) {
            if (info_str.length > 0)
                info_str += "&nbsp; - &nbsp;";
            info_str += STR_RESULT_SCORE + " " + score;
        }
        
        if (DisplayDate == 1) 
        {
        	pgdate = pageinfo[ipage][PAGEINFO_DATETIME];
        	if (pgdate > 0)
        	{        	
	            datetime = new Date(pgdate*1000);
	            if (info_str.length > 0)
	                info_str += "&nbsp; - &nbsp;";
	            info_str += datetime.getDate() + " " + months[datetime.getMonth()] + " " + datetime.getFullYear();
	        }
        }
        
        if (DisplayFilesize == 1) 
        {
			filesize = pageinfo[ipage][PAGEINFO_FILESIZE];
        	filesize = Math.ceil(filesize / 1024);
        	if (filesize < 1)
            	filesize = 1;
            	        	
            if (info_str.length > 0)
                info_str += "&nbsp; - &nbsp;";
            info_str += filesize + "k";
        }        
             
        if (DisplayURL == 1) {
            if (info_str.length > 0)
                info_str += "&nbsp; - &nbsp;";
            info_str += STR_RESULT_URL + " " + pgurl;
        }
                   
        document.writeln("<div class=\"infoline\">");
        document.writeln(info_str);                        
        document.writeln("</div></div>\n");
        arrayline++;
    }

    // Show links to other result pages
    if (num_pages > 1) {
        // 10 results to the left of the current page
        start_range = page - 10;
        if (start_range < 1)
            start_range = 1;

        // 10 to the right
        end_range = page + 10;
        if (end_range > num_pages)
            end_range = num_pages;

        document.writeln("<div class=\"result_pages\">" + STR_RESULT_PAGES + " ");
        if (page > 1)
            document.writeln("<a href=\"" + SelfURL + "?zoom_query=" + queryForURL + "&amp;zoom_page=" + (page-1) + "&amp;zoom_per_page=" + per_page + query_zoom_cats + "&amp;zoom_and=" + andq + "&amp;zoom_sort=" + sort + "\">&lt;&lt; " + STR_RESULT_PAGES_PREVIOUS + "</a> ");
        for (i = start_range; i <= end_range; i++) 
        {
            if (i == page)
                document.writeln(page + " ");
            else
                document.writeln("<a href=\"" + SelfURL + "?zoom_query=" + queryForURL + "&amp;zoom_page=" + i + "&amp;zoom_per_page=" + per_page + query_zoom_cats + "&amp;zoom_and=" + andq + "&amp;zoom_sort=" + sort + "\">" + i + "</a> ");            
        }
        if (page != num_pages)
            document.writeln("<a href=\"" + SelfURL + "?zoom_query=" + queryForURL + "&amp;zoom_page=" + (page+1) + "&amp;zoom_per_page=" + per_page + query_zoom_cats + "&amp;zoom_and=" + andq + "&amp;zoom_sort=" + sort + "\">" + STR_RESULT_PAGES_NEXT + " &gt;&gt;</a> ");
        document.writeln("</div>");
    }

    document.writeln("</div>"); // end results style tag

    if (Timing == 1) {
        timeEnd = new Date();
        timeDifference = timeEnd - timeStart;
        document.writeln("<div class=\"searchtime\"><br /><br />" + STR_SEARCH_TOOK + " " + (timeDifference/1000) + " " + STR_SECONDS + ".</div>\n");
    }

    if (ZoomInfo == 1)
        document.writeln("<center><p><small>" + STR_POWEREDBY + " <a href=\"http://www.wrensoft.com/zoom/\" target=\"_blank\"><b>Zoom Search Engine</b></a></small></p></center>");
}

