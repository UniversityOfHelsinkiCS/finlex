import type {Lang} from "../types"

const LanguageSelection = ({language, handleSelect} : Lang) => {

  const menuStyle = {
    border: '0px solid red',
    marginRight: '0px',
    marginTop: '0px',
  }


  return (
    <div key="searchdiv" style={menuStyle}>
      <select
        data-placeholder="Choose a Language..."
        id="lan"
        value={language}
        onChange={handleSelect}
      >

        <option value="fin">Suomi</option>
        <option value="swe">Svenska</option>
      </select>
    </div>
  )
}

export default LanguageSelection
