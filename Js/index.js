// Copyright (c) 2018 Michael Omondi Otyeno
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
const log = console.log;

//speeches - data file path
const speechesFile = ["Data/speeches-data.json"];

//speeches-data.json file promise
const speechPromise = promise(speechesFile, "json");

//parts of speech / tags
const pos = ["nouns", "verbs", "adverbs", "adjectives", "contractions", 
    "dates", "people", "acronyms", "organizations", "places", "values", 
    "quotations", "terms", "topics", "clauses", "possessives"].reverse();

//echarts tree viz
const tree = echarts.init(document.getElementById("tree"));
const treeOption = {
    tooltip: {
        trigger: "item",
        triggerOn: "mousemove"
    },
    series: [
        {
            type: "tree",
            top: "0%",
            left: "7.5%",
            bottom: "0%",
            right: "8.5%",
            symbolize: 7,
            label: {
                normal: {
                    position: "left",
                    verticalAlign: "middle",
                    align: "right",
                    fontSize: 10,
                    formatter: params => { return (params.value != undefined) ? `${params.name} ${params.value}` : `${params.name}`; }
                }
            },
            leaves: {
                label: {
                    normal: {
                        position: "right",
                        verticalAlign: "middle",
                        align: "left"
                    }
                }
            },
            expandAndCollapse: false
        }
    ]
};

//echarts word cloud viz
const wordCloud = echarts.init(document.getElementById("word-cloud"));
const wordOption = {
    tooltip: {
        trigger: "item",
        triggerOn: "mousemove"
    },
    series: [
        {
            type: "wordCloud",
            left: "center",
            top: "center",
            width: "100%",
            height: "100%",
            right: null,
            bottom: null,
            sizeRange: [9.5, 57.5],
            rotationRange: [-90, 90],
            rotationStep: 10,
            gridSize: 2,
            shape: "pentagon",
            drawOutOfBound: false,
            textStyle: {
                emphasis: {
                    color: "red"
                }
            }
        }
    ]
};

//speech tooltip
const div = d3.select("#detail").append("div")
    .attr("id", "tooltip")
    .style("opacity", 0);

//Loading speeches-data.json
Promise.all(speechPromise).then((resolve) => speechesProcessor(resolve));

//for loading one or multiple files as promise(s)
function PromiseWrapper (d, fileType) {
    return new Promise(function(resolve) {
        d3[fileType](d, function(p) { resolve(p); });
    });
};

//loaded file(s)/promise(s) using PromiseWrapper
function promise(arr, fileType) {
    const promise = arr.map(file => {
        return PromiseWrapper(file, fileType);
    });

    return promise;
};

//process speeches-data.json
function speechesProcessor(json) {
    //All years speeches, search an object in a given array
    const allSpeeches = json[0].data;
    const search = (arr, attr, find) => d3.map(arr, d => d[attr]).get(find);

    //2015 year default
    yearSpeechesBuilder(0);

    //year options and assign change listener
    optionsBuilder(allSpeeches, "year", "Total Speeches", yearSpeechesBuilder);

    //process year speeches
    function yearSpeechesBuilder(yearIndex) {
        //selected year -> speeches, text file paths, text files 
        const yearSpeeches = allSpeeches[yearIndex].speeches;
        const txtPaths = yearSpeeches.map(spch => spch["Text Path"]);
        const txtPromises = promise(txtPaths, "text");

        //Loading selected year text files
        Promise.all(txtPromises).then((resolve) => txtProcessor(resolve));

        //process text file
        function txtProcessor(txts) {
            //first speech default
            vizTableBuilder(0);

            //speech options and assign change listener
            optionsBuilder(yearSpeeches, "Title", "Terms Value", vizTableBuilder);
            
            //Build world Cloud, frequency list, and tags tree
            function vizTableBuilder(txtIndex) {
                //nlp meta data, selected speech, selected speech WordCloudData
                const doc = nlp(txts[txtIndex]);
                const speech = yearSpeeches[txtIndex];
                const typeWordCloudData = speech["WordCloud Data"];

                //speech attributes, title case text
                const speechAttrs = ["Date", "Location", "Main Message"];
                const toTitleCase = (text) => nlp(text).toTitleCase().out("text");

                //assigning data for tree and word cloud viz for selected speech
                //assigning formatter for word cloud viz
                treeOption.series[0].data = [speech["Tree Data"]];
                wordOption.series[0].data = typeWordCloudData;
                wordOption.tooltip.formatter = params => { return `${params.name} : ${params.value}<br> 
                                                                   tags : ${search(typeWordCloudData, "name", params.name).tags}`; };
            
                //wordCloud viz render
                wordCloud.setOption(wordOption);

                //select options for frequency list
                selctOpt("selct-opt", pos);
            
                //scrollable frequency list
                printList(topK("nouns"));
            
                //tree viz render
                tree.setOption(treeOption);

                //assign website link of selected speech to speech details sticky
                document.getElementById("speech-link").href = speech["Url"];
            
                //change event listener for select options for frequency list
                d3.select("#selct-opt select").on("change.pos", function() {
                    const selectedOption = d3.select(this).node().value;
                    printList(topK(selectedOption));
                });

                //speech tooltip mouseover and mouseout event listeners
                d3.select("div#sticky")
                    .on("mouseover.tooltip", tooltipMouseOver)
                    .on("mouseout.tooltip", tooltipMouseOut);

                function tooltipMouseOver() {
                    div.transition()
                        .duration(350)
                        .style("opacity", 0.7);
                    div.html(speechAttrs.reduce((acc, curVal) => acc + `${curVal}: ${speech[curVal]}<br>`, ``)
                                +
                            pos.map(d => d).reverse()
                                .reduce((acc, curVal, curInd, arr) => { 
                                    return (curInd != pos.length - 1) ? acc + `${toTitleCase(curVal)}: ${topK(curVal).length}<br>` : 
                                                                        acc + `${toTitleCase(curVal)}: ${topK(curVal).length}`; }, ``)
                            )
                        .style("top", (d3.event.pageY + 15) + "px");
                };

                function tooltipMouseOut() {
                    div.transition()		
                        .duration(350)
                        .style("opacity", 0);
                };

                //frequency list tag options with topK total length
                function selctOpt(id, arr) {
                    const el = document.getElementById(id);
                    
                    return  el.innerHTML = `<select>
                        ${
                            arr.reduce((acc, curVal) => `<option value="${curVal}">${toTitleCase(curVal)} : ${topK(curVal).length}</option>` + acc, '')
                        }</select>`;
                };
            
                //nlp tag topK array
                function topK(pos) {
                    return doc[pos]().out("topk");
                };

            };
        };
    };

    //builds options with attribute (attr) stats for select element and assigns change event listener
    function optionsBuilder(arr, id, attr, builder) {

        document.getElementById(`${id}-opts`).innerHTML = optionsInnerHTML(arr, id);

        Object.values(document.querySelectorAll(`#${id}-opts option`))
        .forEach((d, i) => d.innerHTML += `: ${arr[i][attr]}`);

        optOnchange(builder);

        function optionsInnerHTML(array, attribute) {
            return array.map(d => `<option value="${d[attribute]}">${d[attribute]}</option>`)
                    .reduce((acc, curVal) => acc + curVal, "");
        };

        function optOnchange(func) {

            d3.select(`select#${id}-opts`).on(`change.${id}`, function() {
                const selectedOption = d3.select(this).node().value;
                const getOptionData = d3.map(arr, d => d[id]).get(selectedOption);
                const selectedIndex = arr.indexOf(getOptionData);
            
                func(selectedIndex);
            });
        };
    };

    //n html space character(s) 
    function spaceChar(n) {
        return d3.range(0, n).map(d => "&nbsp")
                .reduce((acc, curVal) => acc + curVal, '');
    };

    //-------------------------------------------------------------
    //https://beta.observablehq.com/@spencermountain/nlp-compromise
    //builds table based on topK array
    function printList(list) {
        const len = list.length;
        const el = document.getElementById("pos-table");
        
        el.innerHTML = list.reduce((str, o) => {
            str += `<tr>
                <td style="color: #46468B;">${o.normal || o.text || ''}${spaceChar(6)}</td>
                <td style="color: #7A7A8B;">${o.count || ''}${spaceChar(6)}</td>
                <td style="color: #B7B7D1;">${o.percent+ '%'}</td>
            </tr>`;

            return str;
        }, '');
        if(len == 0) {
            el.innerHTML = "----None Exist----";
        };

        return el;
    };
};

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function() {scrollFunction()};
function scrollFunction() {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        document.getElementById("myBtn").style.display = "block";
    } else {
        document.getElementById("myBtn").style.display = "none";
    }
};

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
};


