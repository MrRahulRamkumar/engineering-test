import { Group } from "./entity/group.entity"

export function getStartEndDates(numberOfWeeks: number): { startDate: string; endDate: string } {
  // end date is just the current date
  let ed = new Date()

  // set the start date in the past by the number of weeks
  let sd = new Date()
  sd.setDate(ed.getDate() - 7 * numberOfWeeks)

  // get the sd and ed as yyyy-mm-dd string
  let startDate = sd.toISOString().slice(0, 10)
  let endDate = ed.toISOString().slice(0, 10)

  console.log(startDate, endDate)

  return { startDate, endDate }
}

export function getRollStatesConditionString(rollStates: string): string {
  // make the condition from the input array like 'student_roll_state.state = 'late' OR state = 'student_roll_state.absent'
  const rollStatesToMatch = rollStates.split(",")
  let conditionsString = ""
  for (let i = 0; i < rollStatesToMatch.length; i++) {
    conditionsString += `student_roll_state.state = '${rollStatesToMatch[i]}'`
    if (i < rollStatesToMatch.length - 1) {
      conditionsString += " OR "
    }
  }
  console.log(conditionsString)
  // return with brackets as we want this to be grouped together
  return "(" + conditionsString + ")"
}
