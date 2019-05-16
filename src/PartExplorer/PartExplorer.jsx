import * as React from "react";
import SeqViewer from "./SeqViewer/SeqViewer";
import "./PartExplorer.scss";
import BlankPage from "../BlankPage/BlankPage";
import request from "request";
import shortid from "shortid";
import { annotationFactory, defaultSelection } from "../Utils/sequence";
import { isEqual } from "lodash";
import processPartInput from "../io/processPartInput";
import { SizeMe } from "react-sizeme";
import sizeMe from "react-sizeme";
sizeMe.noPlaceholders = true;

/**
 * a container for investigating the meta and sequence information of a part
 */
class PartExplorer extends React.Component {
  state = {
    seqSelection: defaultSelection,
    findState: {
      searchResults: [],
      searchIndex: 0
    },
    circularCentralIndex: 0,
    linearCentralIndex: 0,
    part: {}
  };

  componentDidMount = async () => {
    const { part: partInput, annotate, colors } = this.props;
    let part = await processPartInput(partInput, colors);
    part = annotate ? await this.autoAnnotate(part) : part;
    this.setState({ part: part });
  };

  shouldComponentUpdate = (nextProps, nextState) =>
    !isEqual(nextProps, this.props) || !isEqual(nextState, this.state);

  setPartState = state => {
    let newState = Object.keys(state).reduce((newState, key) => {
      if (typeof state[key] === "object") {
        newState[key] = { ...this.state[key], ...state[key] };
      } else {
        newState[key] = state[key];
      }
      return newState;
    }, {});
    const { ...rest } = this.state;
    this.setState({ ...rest, ...newState });
  };

  lambdaAnnotate = async part => {
    const result = await new Promise((resolve, reject) => {
      request.post(
        {
          uri: `${String(process.env.REACT_APP_LAMBDA_URL)}/annotate`,
          method: "POST",
          json: JSON.stringify({
            part: { id: shortid.generate(), seq: part.seq.toLowerCase() }
          }),
          headers: {
            "Content-Type": "application/json"
          }
        },
        (err, resp) => {
          if (err) {
            console.log("Error with automatic annotation: ", err);
            return reject(err);
          }
          return resolve(resp.toJSON());
        }
      );
    });
    if (result.statusCode !== 200) {
      const err = JSON.stringify(result.body);
      throw new Error(`Lambda annotations failed. Server response: ${err}`);
    }

    return result;
  };

  autoAnnotate = async (part, colors = []) => {
    const result = await this.lambdaAnnotate(part);
    let annotations = result.body.map(a => ({
      ...annotationFactory(colors),
      ...a
    }));
    // add in the annotations already on the part
    annotations = part.annotations.concat(annotations);
    // filter out duplicates
    annotations = annotations.reduce((acc, a) => {
      if (
        !acc.find(
          ann =>
            ann.name === a.name && ann.start === a.start && ann.end === a.end
        )
      ) {
        return acc.concat(a);
      }
      return acc;
    }, []);
    return { ...part, annotations };
  };

  render() {
    const { viewer, onSelection } = this.props;
    const { part } = this.state;
    const partState = this.state;
    const partAvailable = part.seq || false;
    const linear = viewer === "linear" || viewer === "both";
    const circular = viewer === "circular" || viewer === "both";
    return (
      <div className="part-explorer-container" id="part-explorer">
        {partAvailable && (
          <div className="seq-viewers-container">
            {circular && part.seq.length > 0 && (
              <SizeMe
                monitorHeight
                render={({ size }) => {
                  return (
                    <SeqViewer
                      {...this.props}
                      part={part}
                      {...partState}
                      setPartState={this.setPartState}
                      onSelection={onSelection}
                      size={size}
                      Circular
                    />
                  );
                }}
              />
            )}
            {linear && part.seq.length > 0 && (
              <SizeMe
                monitorHeight
                render={({ size }) => {
                  return (
                    <SeqViewer
                      {...this.props}
                      {...part}
                      {...partState}
                      setPartState={this.setPartState}
                      onSelection={onSelection}
                      size={size}
                      Circular={false}
                    />
                  );
                }}
              />
            )}
            {part.seq.length < 1 && <BlankPage />}
          </div>
        )}
      </div>
    );
  }
}

export default PartExplorer;
